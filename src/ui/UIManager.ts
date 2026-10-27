import type { GameEngine } from '../core/GameEngine';
import { BALL_CONFIGS } from '../entities/BallTypes';
import { soundFX } from '../audio/SoundFX';
import type { BallTypeId } from '../types';
import { PlayerSlotUI } from './PlayerSlotUI';

export class UIManager {
  private engine: GameEngine;

  // Header Elements
  private modeSelectBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private speedSelect!: HTMLSelectElement;
  private rotateToggleBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private muteBtn!: HTMLButtonElement;

  // Battle Mode Panels
  private battleLeftContainer!: HTMLElement;
  private battleRightContainer!: HTMLElement;
  private spawnerList!: HTMLElement;

  // Sandbox Center Elements
  private sandboxCanvasHint!: HTMLElement | null;

  // Sandbox Player Slots
  private p1Slot: PlayerSlotUI;
  private p2Slot: PlayerSlotUI;

  // Battle Roster & Modal
  private rosterList!: HTMLElement;
  private winnerModal!: HTMLElement;
  private modalTrophyBanner!: HTMLElement;
  private winnerText!: HTMLElement;
  private battleModalActions!: HTMLElement;
  private sandboxModalActions!: HTMLElement;
  private winnerPlayAgainBtn!: HTMLButtonElement;
  private btnModalRematch!: HTMLButtonElement;
  private btnModalReaim!: HTMLButtonElement;
  private btnModalRepick!: HTMLButtonElement;

  private cardMap: Map<string, HTMLElement> = new Map();
  private updateThrottle: number = 0;
  private lastMode: string | null = null;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.initElements();
    this.p1Slot = new PlayerSlotUI(1, this.engine, () => this.hideWinnerModal());
    this.p2Slot = new PlayerSlotUI(2, this.engine, () => this.hideWinnerModal());
    this.bindEvents();
    this.renderSpawnerButtons();
  }

  private initElements(): void {
    this.modeSelectBtn = document.getElementById('btn-mode-toggle') as HTMLButtonElement;
    this.pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
    this.speedSelect = document.getElementById('select-speed') as HTMLSelectElement;
    this.rotateToggleBtn = document.getElementById('btn-rotate-box') as HTMLButtonElement;
    this.resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
    this.muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;

    // Battle Mode
    this.battleLeftContainer = document.getElementById('battle-left-container') as HTMLElement;
    this.battleRightContainer = document.getElementById('battle-right-container') as HTMLElement;
    this.spawnerList = document.getElementById('spawner-buttons') as HTMLElement;

    // Sandbox Canvas Hint
    this.sandboxCanvasHint = document.getElementById('sandbox-canvas-hint');

    // Battle Roster & Winner Modal
    this.rosterList = document.getElementById('roster-list') as HTMLElement;
    this.winnerModal = document.getElementById('winner-modal') as HTMLElement;
    this.modalTrophyBanner = document.getElementById('modal-trophy-banner') as HTMLElement;
    this.winnerText = document.getElementById('winner-text') as HTMLElement;
    this.battleModalActions = document.getElementById('battle-modal-actions') as HTMLElement;
    this.sandboxModalActions = document.getElementById('sandbox-modal-actions') as HTMLElement;
    this.winnerPlayAgainBtn = document.getElementById('btn-winner-again') as HTMLButtonElement;
    this.btnModalRematch = document.getElementById('btn-modal-rematch') as HTMLButtonElement;
    this.btnModalReaim = document.getElementById('btn-modal-reaim') as HTMLButtonElement;
    this.btnModalRepick = document.getElementById('btn-modal-repick') as HTMLButtonElement;
  }

  public hideWinnerModal(): void {
    this.winnerModal.classList.add('hidden');
  }

  private bindEvents(): void {
    // Mode toggle
    this.modeSelectBtn.addEventListener('click', () => {
      const newMode = this.engine.gameMode === 'BATTLE' ? 'SANDBOX' : 'BATTLE';
      this.engine.setGameMode(newMode);
      this.updateModeUI();
    });

    // Pause / Resume
    this.pauseBtn.addEventListener('click', () => {
      const isPaused = this.engine.togglePause();
      this.pauseBtn.innerHTML = isPaused ? '▶️ Tiếp Tục' : '⏸️ Tạm Dừng';
      this.pauseBtn.classList.toggle('active', isPaused);
    });

    // Simulation Speed
    this.speedSelect.addEventListener('change', () => {
      const speed = parseFloat(this.speedSelect.value);
      this.engine.setTimeScale(speed);
    });

    // Rotate Box Toggle
    this.rotateToggleBtn.addEventListener('click', () => {
      const isRot = this.engine.toggleRotation();
      this.rotateToggleBtn.classList.toggle('active', isRot);
      this.rotateToggleBtn.innerText = isRot ? '🔄 Hộp Đang Xoay' : '⏹️ Xoay Hộp: Tắt';
    });

    // Reset Match
    this.resetBtn.addEventListener('click', () => {
      this.hideWinnerModal();
      this.cardMap.clear();
      this.rosterList.innerHTML = '';
      this.engine.resetMatch();
      this.update(true);
    });

    // Mute Audio
    this.muteBtn.addEventListener('click', () => {
      const muted = soundFX.toggleMute();
      this.muteBtn.innerText = muted ? '🔇 Tắt Tiếng' : '🔊 Âm Thanh';
      this.muteBtn.classList.toggle('muted', muted);
    });

    // Winner play again
    this.winnerPlayAgainBtn.addEventListener('click', () => {
      this.hideWinnerModal();
      this.cardMap.clear();
      this.rosterList.innerHTML = '';
      this.engine.resetMatch();
      this.update(true);
    });

    // Sandbox Modal Actions
    this.btnModalRematch.addEventListener('click', () => {
      this.hideWinnerModal();
      this.p1Slot.resetStateCache();
      this.p2Slot.resetStateCache();
      this.engine.resetSandboxAim(true);
      this.update(true);
    });

    this.btnModalReaim.addEventListener('click', () => {
      this.hideWinnerModal();
      this.p1Slot.resetStateCache();
      this.p2Slot.resetStateCache();
      this.engine.resetSandboxAim(false);
      this.update(true);
    });

    this.btnModalRepick.addEventListener('click', () => {
      this.hideWinnerModal();
      this.p1Slot.resetStateCache();
      this.p2Slot.resetStateCache();
      this.engine.backToBallSelection();
      this.update(true);
    });
  }

  private renderSpawnerButtons(): void {
    this.spawnerList.innerHTML = '';
    const types = Object.keys(BALL_CONFIGS) as BallTypeId[];

    types.forEach((typeId) => {
      const cfg = BALL_CONFIGS[typeId];
      const btn = document.createElement('button');
      btn.className = 'spawn-btn';
      btn.style.setProperty('--glow', cfg.skin.glowColor);
      btn.innerHTML = `
        <span class="icon">${cfg.skin.icon}</span>
        <div class="meta">
          <strong>${cfg.skin.vietnameseName}</strong>
          <small>${cfg.skill.vietnameseName}</small>
        </div>
        <div class="spawner-stats-badge">
          <span class="sp-stat hp">❤️ ${cfg.baseHp}</span>
          <span class="sp-stat atk">⚔️ ${typeId === 'BLAZE' ? '10+' : cfg.baseAttack}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        this.engine.spawnBall(typeId);
      });
      this.spawnerList.appendChild(btn);
    });

    const actionRow = document.createElement('div');
    actionRow.className = 'spawner-action-row';

    const randBtn = document.createElement('button');
    randBtn.className = 'btn-ctrl btn-accent';
    randBtn.style.flex = '1';
    randBtn.innerHTML = '🎲 Thả Ngẫu Nhiên';
    randBtn.addEventListener('click', () => {
      const randomType = types[Math.floor(Math.random() * types.length)];
      this.engine.spawnBall(randomType);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-ctrl';
    clearBtn.innerHTML = '🧹 Dọn Sạch';
    clearBtn.addEventListener('click', () => {
      this.engine.balls = [];
      this.engine.winner = null;
      this.cardMap.clear();
      this.rosterList.innerHTML = '';
    });

    actionRow.appendChild(randBtn);
    actionRow.appendChild(clearBtn);
    this.spawnerList.appendChild(actionRow);
  }

  private updateModeUI(): void {
    const isBattle = this.engine.gameMode === 'BATTLE';
    const isSandbox = this.engine.gameMode === 'SANDBOX';
    const isOnline = this.engine.gameMode === 'ONLINE_DUEL';

    this.modeSelectBtn.innerHTML = isBattle
      ? '⚔️ Chế độ: <b>Đấu Sinh Tồn</b>'
      : isSandbox
      ? '🎯 Chế độ: <b>Sandbox Đối Kháng</b>'
      : '🌐 Chế độ: <b>Đấu Online 1v1</b>';
    this.modeSelectBtn.className = `btn-mode ${isBattle ? 'battle' : isSandbox ? 'sandbox' : 'online'}`;

    if (isBattle) {
      this.battleLeftContainer.classList.remove('hidden');
      this.battleRightContainer.classList.remove('hidden');
      this.p1Slot.setVisible(false);
      this.p2Slot.setVisible(false);
      if (this.sandboxCanvasHint) this.sandboxCanvasHint.classList.add('hidden');
      this.resetBtn.classList.remove('hidden');
    } else if (isSandbox) {
      this.battleLeftContainer.classList.add('hidden');
      this.battleRightContainer.classList.add('hidden');
      this.p1Slot.setVisible(true);
      this.p2Slot.setVisible(true);
      this.resetBtn.classList.add('hidden');
      this.updateSandboxUI();
    } else if (isOnline) {
      this.battleLeftContainer.classList.add('hidden');
      this.battleRightContainer.classList.add('hidden');
      this.p1Slot.setVisible(false);
      this.p2Slot.setVisible(false);
      if (this.sandboxCanvasHint) this.sandboxCanvasHint.classList.add('hidden');
      this.resetBtn.classList.add('hidden');
    }
  }

  public update(force: boolean = false): void {
    const now = performance.now();
    if (!force && now - this.updateThrottle < 35) return;
    this.updateThrottle = now;

    if (this.lastMode !== this.engine.gameMode) {
      this.lastMode = this.engine.gameMode;
      this.updateModeUI();
    }

    if (this.engine.gameMode === 'ONLINE_DUEL') {
      // In Online mode, all HUD and modals are driven by OnlineUIManager
      return;
    }

    const isBattle = this.engine.gameMode === 'BATTLE';

    // Update Winner / Draw Modal
    if (this.engine.winner || this.engine.isDraw) {
      if (isBattle) {
        this.battleModalActions.classList.remove('hidden');
        this.sandboxModalActions.classList.add('hidden');
        this.modalTrophyBanner.innerText = '👑 VÔ ĐỊCH 👑';
        if (this.engine.winner) {
          this.winnerText.innerHTML = `
            <div class="winner-icon">${this.engine.winner.skin.icon}</div>
            <h2>${this.engine.winner.skin.vietnameseName} Đã Thắng!</h2>
            <p>Chiến thắng tuyệt đối với <b>${this.engine.winner.kills} mạng hạ gục</b> và <b>${this.engine.winner.bounces} lần nảy</b>.</p>
          `;
        }
      } else {
        // Sandbox Mode Modal
        this.battleModalActions.classList.add('hidden');
        this.sandboxModalActions.classList.remove('hidden');
        if (this.engine.isDraw) {
          this.modalTrophyBanner.innerText = '🤝 BẤT PHÂN THẮNG BẠI 🤝';
          this.winnerText.innerHTML = `
            <div class="winner-icon">💥</div>
            <h2>HÒA NHAU!</h2>
            <p>Cả 2 đấu sĩ đã cùng lúc bị hạ gục trong pha va chạm bùng nổ!</p>
          `;
        } else if (this.engine.winner) {
          this.modalTrophyBanner.innerText = '🏆 KẾT QUẢ ĐỐI KHÁNG 🏆';
          this.winnerText.innerHTML = `
            <div class="winner-icon">${this.engine.winner.skin.icon}</div>
            <h2>${this.engine.winner.skin.vietnameseName} Chiến Thắng!</h2>
            <p>Đã hạ gục đối thủ sau <b>${this.engine.winner.bounces} lần nảy</b> với <b>${Math.round(this.engine.winner.damageDealt)} sát thương</b>.</p>
          `;
        }
      }
      this.winnerModal.classList.remove('hidden');
    }

    if (!isBattle) {
      this.updateSandboxUI();
    }

    this.renderRoster(isBattle);
  }

  private updateSandboxUI(): void {
    const phase = this.engine.sandboxPhase;
    const isBattlePhase = phase === 'BATTLE';

    if (this.sandboxCanvasHint) {
      this.sandboxCanvasHint.classList.toggle('hidden', isBattlePhase || phase === 'COUNTDOWN');
    }

    this.p1Slot.update(isBattlePhase);
    this.p2Slot.update(isBattlePhase);
  }

  private renderRoster(isBattle: boolean): void {
    if (!isBattle) return; // In Sandbox mode, P1 is on left, P2 on right

    const balls = this.engine.balls;

    if (balls.length === 0) {
      this.cardMap.clear();
      this.rosterList.innerHTML = '<div class="empty-roster">Chưa có quả bóng nào trong hộp! Hãy bấm nút thêm bóng.</div>';
      return;
    }

    const emptyMsg = this.rosterList.querySelector('.empty-roster');
    if (emptyMsg) {
      this.rosterList.innerHTML = '';
      this.cardMap.clear();
    }

    const currentBallIds = new Set(balls.map((b) => b.id));
    for (const [id, cardEl] of this.cardMap.entries()) {
      if (!currentBallIds.has(id)) {
        cardEl.remove();
        this.cardMap.delete(id);
      }
    }

    balls.forEach((ball) => {
      let card = this.cardMap.get(ball.id);

      if (!card) {
        card = document.createElement('div');
        card.className = 'roster-card';
        card.dataset.ballId = ball.id;
        card.style.setProperty('--ball-color', ball.skin.glowColor);

        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `
          <div class="ball-title">
            <span class="icon">${ball.skin.icon}</span>
            <strong>${ball.skin.vietnameseName}</strong>
          </div>
          <div class="header-right">
            <span class="badge status-badge"></span>
            <button class="btn-del-ball" title="Xóa bóng này">✕</button>
          </div>
        `;
        card.appendChild(header);

        const hpSection = document.createElement('div');
        hpSection.className = 'bar-container hp-section';
        hpSection.innerHTML = `
          <div class="bar-label"><span>HP</span><span class="hp-val"></span></div>
          <div class="bar-track hp"><div class="bar-fill hp-fill"></div></div>
        `;
        card.appendChild(hpSection);

        const cdSection = document.createElement('div');
        cdSection.className = 'bar-container';
        cdSection.innerHTML = `
          <div class="bar-label"><span>${ball.typeId === 'GOKU' ? 'Nộ khí SonGoku' : 'Hồi chiêu Skill'}</span><span class="cd-val"></span></div>
          <div class="bar-track skill"><div class="bar-fill cd-fill"></div></div>
        `;
        card.appendChild(cdSection);

        const footer = document.createElement('div');
        footer.className = 'card-footer';
        footer.innerHTML = `
          <span class="kills-val"></span>
          <button class="btn-trigger-skill" title="Kích hoạt skill tức thì">⚡ ${ball.skill.vietnameseName}</button>
        `;
        card.appendChild(footer);

        const delBtn = header.querySelector('.btn-del-ball') as HTMLButtonElement | null;
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.engine.balls = this.engine.balls.filter((b) => b.id !== ball.id);
          });
        }

        const triggerBtn = footer.querySelector('.btn-trigger-skill') as HTMLButtonElement;
        triggerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          ball.cooldownTimer = 0;
          ball.activateSkill(this.engine.balls, this.engine.vfx);
        });

        this.rosterList.appendChild(card);
        this.cardMap.set(ball.id, card);
      }

      card.className = `roster-card ${ball.isDead ? 'dead' : ''} ${ball.isSkillActive ? 'active-skill' : ''}`;

      const badge = card.querySelector('.status-badge') as HTMLElement;
      if (ball.isDead) {
        badge.className = 'badge status-badge dead';
        badge.innerText = '💀 ĐÃ BỊ HẠ';
      } else if (ball.isSkillActive) {
        badge.className = 'badge status-badge skill';
        badge.innerText = '⚡ SKILL!';
      } else if (ball.statusEffects.some((e) => e.type === 'FROZEN_SOLID')) {
        badge.className = 'badge status-badge frozen';
        badge.innerText = '🧊 ĐÓNG CỨNG';
      } else if (ball.statusEffects.some((e) => e.type === 'FROZEN')) {
        badge.className = 'badge status-badge frozen';
        badge.innerText = '❄️ CHẬM 60%';
      } else if (ball.statusEffects.some((e) => e.type === 'POISONED')) {
        badge.className = 'badge status-badge poison';
        badge.innerText = '🧪 NHIỄM ĐỘC';
      } else {
        badge.className = 'badge status-badge live';
        badge.innerText = `🟢 NẢY: ${ball.bounces}`;
      }

      const hpVal = card.querySelector('.hp-val') as HTMLElement;
      const hpFill = card.querySelector('.hp-fill') as HTMLElement;
      hpVal.innerText = `${Math.round(ball.hp)} / ${ball.maxHp}`;
      const hpPct = Math.max(0, Math.round((ball.hp / ball.maxHp) * 100));
      hpFill.style.width = `${hpPct}%`;

      const cdVal = card.querySelector('.cd-val') as HTMLElement;
      const cdFill = card.querySelector('.cd-fill') as HTMLElement;
      const cdPct = ball.typeId === 'GOKU'
        ? Math.round(Math.max(0, Math.min(100, ball.gokuRage)))
        : ball.isSkillActive
        ? 100
        : Math.round(Math.max(0, 1 - ball.cooldownTimer / ball.skill.cooldown) * 100);
      cdVal.innerText = ball.typeId === 'GOKU'
        ? `${cdPct}% · ${Math.round((16 + (90 - 16) * cdPct / 100) * 0.7)} sát thương`
        : ball.isSkillActive ? 'ĐANG DÙNG' : `${cdPct}%`;
      cdFill.style.width = `${cdPct}%`;

      const killsVal = card.querySelector('.kills-val') as HTMLElement;
      killsVal.innerHTML = `Hạ: <b>${ball.kills}</b>`;
    });
  }
}
