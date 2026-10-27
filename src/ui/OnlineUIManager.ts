import type { OnlineGameManager } from '../network/OnlineGameManager';
import { peerConnection } from '../network/PeerConnection';
import { BALL_CONFIGS, HERO_EXTRA_META } from '../entities/BallTypes';
import type { BallTypeId } from '../types';
import { soundFX } from '../audio/SoundFX';

export class OnlineUIManager {
  private manager: OnlineGameManager;

  // DOM Modals
  private lobbyModal!: HTMLElement;
  private draftModal!: HTMLElement;
  private selectHeroModal!: HTMLElement;
  private roundOverModal!: HTMLElement;
  private matchOverModal!: HTMLElement;

  // Topbar & Controls
  private btnOnlineMode!: HTMLButtonElement;

  // Lobby elements
  private btnCreateRoom!: HTMLButtonElement;
  private btnJoinRoom!: HTMLButtonElement;
  private inputRoomCode!: HTMLInputElement;
  private hostRoomInfo!: HTMLElement;
  private hostRoomCodeDisplay!: HTMLElement;
  private btnCopyLink!: HTMLButtonElement;
  private lobbyStatusText!: HTMLElement;
  private btnCloseLobby!: HTMLButtonElement;

  // Draft elements
  private draftTurnText!: HTMLElement;
  private draftP1Slots!: HTMLElement;
  private draftP2Slots!: HTMLElement;
  private draftHeroGrid!: HTMLElement;

  // Select Hero elements
  private selectHeroTitle!: HTMLElement;
  private selectHeroSubtitle!: HTMLElement;
  private selectHeroRoster!: HTMLElement;

  // Round Over elements
  private roundOverTitle!: HTMLElement;
  private roundOverWinner!: HTMLElement;
  private roundOverP1Roster!: HTMLElement;
  private roundOverP2Roster!: HTMLElement;
  private btnRoundContinue!: HTMLButtonElement;

  // Match Over elements
  private matchOverTitle!: HTMLElement;
  private matchOverWinner!: HTMLElement;
  private btnMatchRematch!: HTMLButtonElement;
  private btnMatchExit!: HTMLButtonElement;

  // Aiming Controls (Online Panel HUD)
  private onlinePanel!: HTMLElement;
  private onlineAngleSlider!: HTMLInputElement;
  private onlineAngleVal!: HTMLElement;
  private btnOnlineRandomAngle!: HTMLButtonElement;
  private btnOnlineReady!: HTMLButtonElement;
  private onlineStatusBadge!: HTMLElement;
  private onlinePresets!: NodeListOf<HTMLButtonElement>;

  // Battle HUD elements
  private onlineBattleSection!: HTMLElement;
  private onlineSetupSection!: HTMLElement;
  private onlineHeroCard!: HTMLElement;
  private onlineLiveHpText!: HTMLElement;
  private onlineLiveHpBar!: HTMLElement;
  private onlineLiveSkillName!: HTMLElement;
  private onlineLiveSkillStatus!: HTMLElement;
  private onlineLiveSkillBar!: HTMLElement;
  private onlineLiveDmg!: HTMLElement;
  private onlineLiveBounces!: HTMLElement;
  private onlineLiveSpeed!: HTMLElement;

  constructor(manager: OnlineGameManager) {
    this.manager = manager;
    this.initElements();
    this.bindEvents();
    this.setupManagerCallbacks();
    this.checkUrlForRoomCode();
  }

  private initElements() {
    this.btnOnlineMode = document.getElementById('btn-online-duel') as HTMLButtonElement;

    // Modals
    this.lobbyModal = document.getElementById('online-lobby-modal') as HTMLElement;
    this.draftModal = document.getElementById('online-draft-modal') as HTMLElement;
    this.selectHeroModal = document.getElementById('online-select-hero-modal') as HTMLElement;
    this.roundOverModal = document.getElementById('online-round-over-modal') as HTMLElement;
    this.matchOverModal = document.getElementById('online-match-over-modal') as HTMLElement;

    // Lobby
    this.btnCreateRoom = document.getElementById('btn-create-room') as HTMLButtonElement;
    this.btnJoinRoom = document.getElementById('btn-join-room') as HTMLButtonElement;
    this.inputRoomCode = document.getElementById('input-room-code') as HTMLInputElement;
    this.hostRoomInfo = document.getElementById('host-room-info') as HTMLElement;
    this.hostRoomCodeDisplay = document.getElementById('display-room-code') as HTMLElement;
    this.btnCopyLink = document.getElementById('btn-copy-invite-link') as HTMLButtonElement;
    this.lobbyStatusText = document.getElementById('lobby-status-text') as HTMLElement;
    this.btnCloseLobby = document.getElementById('btn-close-lobby') as HTMLButtonElement;

    // Draft
    this.draftTurnText = document.getElementById('draft-turn-text') as HTMLElement;
    this.draftP1Slots = document.getElementById('draft-p1-slots') as HTMLElement;
    this.draftP2Slots = document.getElementById('draft-p2-slots') as HTMLElement;
    this.draftHeroGrid = document.getElementById('draft-hero-grid') as HTMLElement;

    // Select Hero
    this.selectHeroTitle = document.getElementById('select-hero-title') as HTMLElement;
    this.selectHeroSubtitle = document.getElementById('select-hero-subtitle') as HTMLElement;
    this.selectHeroRoster = document.getElementById('select-hero-roster') as HTMLElement;

    // Round Over
    this.roundOverTitle = document.getElementById('round-over-title') as HTMLElement;
    this.roundOverWinner = document.getElementById('round-over-winner') as HTMLElement;
    this.roundOverP1Roster = document.getElementById('round-over-p1-roster') as HTMLElement;
    this.roundOverP2Roster = document.getElementById('round-over-p2-roster') as HTMLElement;
    this.btnRoundContinue = document.getElementById('btn-round-continue') as HTMLButtonElement;

    // Match Over
    this.matchOverTitle = document.getElementById('match-over-title') as HTMLElement;
    this.matchOverWinner = document.getElementById('match-over-winner') as HTMLElement;
    this.btnMatchRematch = document.getElementById('btn-match-rematch') as HTMLButtonElement;
    this.btnMatchExit = document.getElementById('btn-match-exit') as HTMLButtonElement;

    // Online Panel Controls
    this.onlinePanel = document.getElementById('online-duel-panel') as HTMLElement;
    this.onlineAngleSlider = document.getElementById('online-angle-slider') as HTMLInputElement;
    this.onlineAngleVal = document.getElementById('online-angle-val') as HTMLElement;
    this.btnOnlineRandomAngle = document.getElementById('btn-online-random-angle') as HTMLButtonElement;
    this.btnOnlineReady = document.getElementById('btn-online-ready') as HTMLButtonElement;
    this.onlineStatusBadge = document.getElementById('online-status-badge') as HTMLElement;
    this.onlinePresets = document.querySelectorAll<HTMLButtonElement>('.btn-online-preset');

    // Online HUD
    this.onlineBattleSection = document.getElementById('online-battle-section') as HTMLElement;
    this.onlineSetupSection = document.getElementById('online-setup-section') as HTMLElement;
    this.onlineHeroCard = document.getElementById('online-hud-hero-card') as HTMLElement;
    this.onlineLiveHpText = document.getElementById('online-live-hp-text') as HTMLElement;
    this.onlineLiveHpBar = document.getElementById('online-live-hp-bar') as HTMLElement;
    this.onlineLiveSkillName = document.getElementById('online-live-skill-name') as HTMLElement;
    this.onlineLiveSkillStatus = document.getElementById('online-live-skill-status') as HTMLElement;
    this.onlineLiveSkillBar = document.getElementById('online-live-skill-bar') as HTMLElement;
    this.onlineLiveDmg = document.getElementById('online-live-dmg') as HTMLElement;
    this.onlineLiveBounces = document.getElementById('online-live-bounces') as HTMLElement;
    this.onlineLiveSpeed = document.getElementById('online-live-speed') as HTMLElement;
  }

  private checkUrlForRoomCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.openLobbyModal();
      this.inputRoomCode.value = roomParam.trim().toUpperCase();
      this.joinRoom(roomParam.trim().toUpperCase());
    }
  }

  private bindEvents() {
    // Topbar Online Button
    this.btnOnlineMode?.addEventListener('click', () => {
      this.openLobbyModal();
    });

    // Create Room
    this.btnCreateRoom?.addEventListener('click', async () => {
      this.btnCreateRoom.disabled = true;
      this.lobbyStatusText.innerText = '⏳ Đang khởi tạo phòng P2P WebRTC...';
      try {
        const code = await peerConnection.createRoom();
        this.manager.initAsHost(code);
        this.hostRoomInfo.classList.remove('hidden');
        this.hostRoomCodeDisplay.innerText = code;
        this.lobbyStatusText.innerText = `🟢 Phòng ${code} đã sẵn sàng! Hãy chia sẻ mã hoặc link cho bạn bè.`;
        soundFX.playWallBounce(2.0);
      } catch (err: any) {
        this.lobbyStatusText.innerText = `❌ Lỗi tạo phòng: ${err.message || err}`;
        this.btnCreateRoom.disabled = false;
      }
    });

    // Copy Invite Link
    this.btnCopyLink?.addEventListener('click', () => {
      const code = this.hostRoomCodeDisplay.innerText.trim();
      if (!code) return;
      const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
      navigator.clipboard.writeText(url).then(() => {
        const originalText = this.btnCopyLink.innerText;
        this.btnCopyLink.innerText = '✅ Đã Sao Chép Link!';
        setTimeout(() => {
          this.btnCopyLink.innerText = originalText;
        }, 2000);
      });
    });

    // Join Room
    this.btnJoinRoom?.addEventListener('click', () => {
      const code = this.inputRoomCode.value.trim().toUpperCase();
      if (!code) {
        alert('Vui lòng nhập mã phòng!');
        return;
      }
      this.joinRoom(code);
    });

    // Close Lobby
    this.btnCloseLobby?.addEventListener('click', () => {
      this.lobbyModal.classList.add('hidden');
    });

    // Angle Slider & Presets
    this.onlineAngleSlider?.addEventListener('input', () => {
      const deg = parseInt(this.onlineAngleSlider.value, 10);
      this.onlineAngleVal.innerText = `${deg}°`;
      const rad = (deg * Math.PI) / 180;
      this.manager.setMyAimAngle(rad);
    });

    this.btnOnlineRandomAngle?.addEventListener('click', () => {
      const deg = Math.floor(Math.random() * 360);
      this.onlineAngleSlider.value = String(deg);
      this.onlineAngleVal.innerText = `${deg}°`;
      const rad = (deg * Math.PI) / 180;
      this.manager.setMyAimAngle(rad);
      soundFX.playAimTick();
    });

    this.onlinePresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        const deg = parseInt(btn.dataset.angle || '0', 10);
        this.onlineAngleSlider.value = String(deg);
        this.onlineAngleVal.innerText = `${deg}°`;
        const rad = (deg * Math.PI) / 180;
        this.manager.setMyAimAngle(rad);
        soundFX.playAimTick();
      });
    });

    // Ready Button
    this.btnOnlineReady?.addEventListener('click', () => {
      if (this.manager.myReady) return;
      this.manager.setMyReady(true);
      this.updateAimingUI();
    });

    // Round Continue Button
    this.btnRoundContinue?.addEventListener('click', () => {
      this.roundOverModal.classList.add('hidden');
      this.manager.proceedFromRoundOverToCounterPick();
    });

    // Rematch Button
    this.btnMatchRematch?.addEventListener('click', () => {
      this.matchOverModal.classList.add('hidden');
      this.manager.requestRematch();
    });

    this.btnMatchExit?.addEventListener('click', () => {
      this.matchOverModal.classList.add('hidden');
      peerConnection.disconnect();
      window.location.search = '';
    });

    // Connect Engine dragging hook
    this.manager.engine.onOnlineAimChanged = (rad: number) => {
      let deg = Math.round((rad * 180) / Math.PI);
      if (deg < 0) deg += 360;
      deg = deg % 360;
      this.onlineAngleSlider.value = String(deg);
      this.onlineAngleVal.innerText = `${deg}°`;
      this.manager.setMyAimAngle(rad);
    };
  }

  private async joinRoom(code: string) {
    this.btnJoinRoom.disabled = true;
    this.lobbyStatusText.innerText = `⏳ Đang kết nối tới phòng ${code}...`;
    try {
      this.manager.initAsGuest();
      await peerConnection.joinRoom(code);
      this.lobbyStatusText.innerText = `🟢 Kết nối thành công! Đang vào màn hình cấm chọn...`;
      soundFX.playWallBounce(2.0);
      this.manager.onlinePhase = 'DRAFT';
      this.syncUIWithOnlineState();
    } catch (err: any) {
      this.lobbyStatusText.innerText = `❌ Không thể tham gia: ${err.message || err}`;
      this.btnJoinRoom.disabled = false;
    }
  }

  private setupManagerCallbacks() {
    this.manager.onStateChanged = () => {
      this.syncUIWithOnlineState();
    };

    this.manager.onRoundEnded = (winnerIdx, survivingHero, remainingHp) => {
      this.showRoundOverModal(winnerIdx, survivingHero, remainingHp);
    };

    this.manager.onMatchEnded = (winnerIdx) => {
      this.showMatchOverModal(winnerIdx);
    };
  }

  public openLobbyModal() {
    this.lobbyModal.classList.remove('hidden');
  }

  // ==========================================
  // STATE-DRIVEN UI SYNCHRONIZATION
  // ==========================================

  public syncUIWithOnlineState() {
    const phase = this.manager.onlinePhase;

    // Switch panels visibility
    const isOnlineActive = phase !== 'LOBBY';
    const leftBattle = document.getElementById('battle-left-container');
    const rightBattle = document.getElementById('battle-right-container');
    const p1Sandbox = document.getElementById('sandbox-p1-panel');
    const p2Sandbox = document.getElementById('sandbox-p2-panel');

    if (isOnlineActive) {
      leftBattle?.classList.add('hidden');
      rightBattle?.classList.add('hidden');
      p1Sandbox?.classList.add('hidden');
      p2Sandbox?.classList.add('hidden');
      this.onlinePanel?.classList.remove('hidden');
    }

    switch (phase) {
      case 'LOBBY': {
        this.lobbyModal.classList.remove('hidden');
        this.draftModal.classList.add('hidden');
        this.selectHeroModal.classList.add('hidden');
        break;
      }

      case 'DRAFT': {
        this.lobbyModal.classList.add('hidden');
        this.draftModal.classList.remove('hidden');
        this.selectHeroModal.classList.add('hidden');
        this.renderDraftScreen();
        break;
      }

      case 'SELECT_ROUND_HERO': {
        this.draftModal.classList.add('hidden');
        this.selectHeroModal.classList.remove('hidden');
        this.renderSelectHeroScreen();
        break;
      }

      case 'AIMING':
      case 'COUNTDOWN': {
        this.draftModal.classList.add('hidden');
        this.selectHeroModal.classList.add('hidden');
        this.roundOverModal.classList.add('hidden');
        this.matchOverModal.classList.add('hidden');
        this.updateAimingUI();
        break;
      }

      case 'BATTLE': {
        this.draftModal.classList.add('hidden');
        this.selectHeroModal.classList.add('hidden');
        this.onlineSetupSection.classList.add('hidden');
        this.onlineBattleSection.classList.remove('hidden');
        this.updateBattleHUD();
        break;
      }
    }
  }

  // ==========================================
  // DRAFT PICK RENDERING
  // ==========================================

  private renderDraftScreen() {
    const isMyTurn = this.manager.currentDraftTurn === this.manager.myPlayerIdx;
    const currentTurnPlayer = this.manager.currentDraftTurn === 1 ? 'ĐẤU SĨ 1 (XANH)' : 'ĐẤU SĨ 2 (ĐỎ)';

    if (isMyTurn) {
      this.draftTurnText.innerHTML = `👉 <span style="color: #4ade80; font-weight: 800;">LƯỢT CỦA BẠN!</span> Hãy chọn 1 tướng`;
    } else {
      this.draftTurnText.innerHTML = `⏳ Đang chờ <b>${currentTurnPlayer}</b> chọn tướng...`;
    }

    // Render Slots P1
    this.draftP1Slots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const heroId = this.manager.draftPicks.p1[i];
      this.draftP1Slots.appendChild(this.createDraftSlotElement(heroId, 1, i + 1));
    }

    // Render Slots P2
    this.draftP2Slots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const heroId = this.manager.draftPicks.p2[i];
      this.draftP2Slots.appendChild(this.createDraftSlotElement(heroId, 2, i + 1));
    }

    // Render 16 Heroes Grid
    this.draftHeroGrid.innerHTML = '';
    const allHeroIds = Object.keys(BALL_CONFIGS) as BallTypeId[];

    for (const heroId of allHeroIds) {
      const cfg = BALL_CONFIGS[heroId];
      const meta = HERO_EXTRA_META[heroId];
      const isPickedByP1 = this.manager.draftPicks.p1.includes(heroId);
      const isPickedByP2 = this.manager.draftPicks.p2.includes(heroId);
      const isPicked = isPickedByP1 || isPickedByP2;

      const card = document.createElement('div');
      card.className = `draft-hero-card ${isPicked ? 'picked' : ''} ${isMyTurn && !isPicked ? 'selectable' : ''}`;
      card.innerHTML = `
        <div class="draft-hero-icon" style="background: ${cfg.skin.primaryColor}22; border-color: ${cfg.skin.primaryColor};">
          <span>${cfg.skin.icon}</span>
        </div>
        <div class="draft-hero-name">${cfg.skin.vietnameseName}</div>
        <div class="draft-hero-role" style="color: ${meta?.roleColor || '#94a3b8'};">${meta?.role || 'Đấu Sĩ'}</div>
        ${isPicked ? `<div class="draft-picked-tag">${isPickedByP1 ? 'P1' : 'P2'}</div>` : ''}
      `;

      if (isMyTurn && !isPicked) {
        card.addEventListener('click', () => {
          this.manager.selectDraftHero(heroId);
        });
      }

      this.draftHeroGrid.appendChild(card);
    }
  }

  private createDraftSlotElement(heroId: BallTypeId | undefined, playerIdx: 1 | 2, slotIndex: number): HTMLElement {
    const el = document.createElement('div');
    el.className = `draft-slot-box ${heroId ? 'filled' : 'empty'} p${playerIdx}`;

    if (heroId) {
      const cfg = BALL_CONFIGS[heroId];
      el.innerHTML = `
        <span class="slot-hero-icon">${cfg.skin.icon}</span>
        <div class="slot-hero-info">
          <strong class="slot-hero-name">${cfg.skin.vietnameseName}</strong>
          <span class="slot-hero-hp">❤️ ${cfg.baseHp} HP | ⚔️ ${cfg.baseAttack}</span>
        </div>
      `;
    } else {
      el.innerHTML = `
        <span class="slot-placeholder-icon">⚔️</span>
        <span class="slot-placeholder-text">Vị Trí ${slotIndex}</span>
      `;
    }
    return el;
  }

  // ==========================================
  // SELECT HERO FOR ROUND (Vanguard / Counter-pick)
  // ==========================================

  private renderSelectHeroScreen() {
    const isRound1 = this.manager.currentRound === 1;
    const myActive = this.manager.myPlayerIdx === 1 ? this.manager.p1ActiveHero : this.manager.p2ActiveHero;
    const myHp = this.manager.myPlayerIdx === 1 ? this.manager.p1CurrentHp : this.manager.p2CurrentHp;

    if (!isRound1 && myActive) {
      const myCfg = BALL_CONFIGS[myActive];
      this.selectHeroTitle.innerText = `🛡️ ĐANG TRẤN GIỮ SÀN ĐẤU (HIỆP ${this.manager.currentRound})`;
      this.selectHeroSubtitle.innerHTML = `
        <div style="background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.4); padding: 12px; border-radius: 10px; color: #86efac; font-size: 13px;">
          <span>🎉 Đấu sĩ của bạn <b>${myCfg.skin.icon} ${myCfg.skin.vietnameseName}</b> (${myHp} HP) đã thắng hiệp trước và giữ nguyên vị trí!</span>
          <div style="margin-top: 6px; color: #cbd5e1; font-size: 12px;">⏳ Đang chờ đối thủ chọn tướng counter-pick ra sân...</div>
        </div>
      `;
      this.selectHeroRoster.innerHTML = '';
      return;
    }

    this.selectHeroTitle.innerText = isRound1
      ? '⚔️ CHỌN ĐẤU SĨ TIÊN PHONG (HIỆP 1)'
      : `🔥 CHỌN ĐẤU SĨ RA SÂN KHẮC CHẾ (HIỆP ${this.manager.currentRound})`;

    const opponentIdx = this.manager.opponentPlayerIdx;
    const myRoster = this.manager.myPlayerIdx === 1 ? this.manager.p1Roster : this.manager.p2Roster;

    const opponentActive = opponentIdx === 1 ? this.manager.p1ActiveHero : this.manager.p2ActiveHero;
    const opponentHp = opponentIdx === 1 ? this.manager.p1CurrentHp : this.manager.p2CurrentHp;

    if (!isRound1 && opponentActive) {
      const oppCfg = BALL_CONFIGS[opponentActive];
      this.selectHeroSubtitle.innerHTML = `
        <div class="opponent-alert-box">
          <span>⚠️ Đấu sĩ đối thủ đang trấn giữ sàn:</span>
          <strong>${oppCfg.skin.icon} ${oppCfg.skin.vietnameseName}</strong>
          <span class="opp-hp-badge">❤️ ${opponentHp} HP</span>
        </div>
      `;
    } else {
      this.selectHeroSubtitle.innerHTML = `Hãy chọn 1 trong các tướng còn sống trong đội hình 3 bóng của bạn:`;
    }

    this.selectHeroRoster.innerHTML = '';
    for (const item of myRoster) {
      const cfg = BALL_CONFIGS[item.heroId];
      const meta = HERO_EXTRA_META[item.heroId];
      const isDead = item.isDead || item.currentHp <= 0;

      const card = document.createElement('div');
      card.className = `round-pick-card ${isDead ? 'dead' : 'available'}`;
      card.innerHTML = `
        <div class="round-pick-icon">${cfg.skin.icon}</div>
        <div class="round-pick-details">
          <h4>${cfg.skin.vietnameseName}</h4>
          <span class="role" style="color: ${meta?.roleColor || '#94a3b8'};">${meta?.role || 'Đấu Sĩ'}</span>
          <div class="hp-info">
            <span class="hp-text">Sinh lực: <b>${isDead ? 0 : item.currentHp} / ${item.maxHp}</b></span>
            <div class="hp-mini-track">
              <div class="hp-mini-fill" style="width: ${Math.round((item.currentHp / item.maxHp) * 100)}%;"></div>
            </div>
          </div>
        </div>
        <button class="btn-select-round ${isDead ? 'disabled' : ''}">
          ${isDead ? '💀 ĐÃ BỊ HẠ' : '🚀 XUẤT TRẬN'}
        </button>
      `;

      if (!isDead) {
        card.addEventListener('click', () => {
          this.manager.selectHeroForRound(item.heroId);
          this.selectHeroModal.classList.add('hidden');
        });
      }

      this.selectHeroRoster.appendChild(card);
    }
  }

  // ==========================================
  // AIMING & READY UI
  // ==========================================

  private updateAimingUI() {
    this.onlineSetupSection.classList.remove('hidden');
    this.onlineBattleSection.classList.add('hidden');

    if (this.manager.myReady) {
      this.onlineStatusBadge.className = 'badge ready';
      this.onlineStatusBadge.innerText = '🟢 Đã Sẵn Sàng (Đợi đối thủ...)';
      this.btnOnlineReady.innerText = '⏳ Đang Đợi Đối Thủ...';
      this.btnOnlineReady.disabled = true;
    } else {
      this.onlineStatusBadge.className = 'badge not-ready';
      this.onlineStatusBadge.innerText = '🔴 Chưa Sẵn Sàng (Đang ngắm)';
      this.btnOnlineReady.innerText = '✅ Xác Nhận Sẵn Sàng';
      this.btnOnlineReady.disabled = false;
    }

    if (this.manager.onlinePhase === 'COUNTDOWN') {
      this.onlineStatusBadge.className = 'badge ready';
      this.onlineStatusBadge.innerText = '⚡ ĐANG ĐẾM NGƯỢC XUẤT PHÁT!';
    }
  }

  // ==========================================
  // LIVE COMBAT HUD
  // ==========================================

  public updateBattleHUD() {
    const ball = this.manager.myPlayerIdx === 1 ? this.manager.engine.p1Ball : this.manager.engine.p2Ball;
    if (!ball) return;

    // Hero Card
    this.onlineHeroCard.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 26px;">${ball.skin.icon}</span>
        <div>
          <strong style="color: ${ball.skin.primaryColor}; font-size: 14px;">${ball.skin.vietnameseName}</strong>
          <div style="font-size: 11px; color: #94a3b8;">${HERO_EXTRA_META[ball.typeId]?.role || 'Đấu Sĩ'}</div>
        </div>
      </div>
    `;

    // HP Bar
    const hp = Math.max(0, Math.round(ball.hp));
    this.onlineLiveHpText.innerText = `${hp} / ${ball.maxHp}`;
    const pct = Math.min(100, Math.max(0, (hp / ball.maxHp) * 100));
    this.onlineLiveHpBar.style.width = `${pct}%`;

    // Skill Bar
    this.onlineLiveSkillName.innerText = `⚡ ${ball.skill.vietnameseName}`;
    if (ball.isSkillActive) {
      this.onlineLiveSkillStatus.innerText = '🔥 ĐANG KÍCH HOẠT!';
      this.onlineLiveSkillBar.style.width = '100%';
      this.onlineLiveSkillBar.className = 'hud-bar-fill skill-fill active';
    } else {
      const charge = Math.min(1, Math.max(0, 1 - ball.cooldownTimer / ball.skill.cooldown));
      const chargePct = Math.round(charge * 100);
      this.onlineLiveSkillStatus.innerText = charge >= 1 ? 'SẴN SÀNG!' : `Nạp ${chargePct}%`;
      this.onlineLiveSkillBar.style.width = `${chargePct}%`;
      this.onlineLiveSkillBar.className = 'hud-bar-fill skill-fill';
    }

    // Stats
    this.onlineLiveDmg.innerText = String(Math.round(ball.damageDealt));
    this.onlineLiveBounces.innerText = String(ball.bounces);
    this.onlineLiveSpeed.innerText = String(Math.round(Math.hypot(ball.vx, ball.vy)));
  }

  // ==========================================
  // MODAL RESULTS
  // ==========================================

  private showRoundOverModal(winnerIdx: 1 | 2 | null, survivingHero: BallTypeId | null, remainingHp: number) {
    this.roundOverModal.classList.remove('hidden');
    this.roundOverTitle.innerText = `🏁 KẾT THÚC HIỆP ${this.manager.currentRound - 1}!`;

    if (winnerIdx !== null && survivingHero) {
      const cfg = BALL_CONFIGS[survivingHero];
      const isMe = winnerIdx === this.manager.myPlayerIdx;
      this.roundOverWinner.innerHTML = `
        <div class="round-winner-card ${isMe ? 'winner-me' : 'winner-opp'}">
          <span class="trophy">${isMe ? '🎉 BẠN THẮNG HIỆP NÀY! 🎉' : '💀 ĐỐI THỦ THẮNG HIỆP NÀY!'}</span>
          <h3>${cfg.skin.icon} ${cfg.skin.vietnameseName}</h3>
          <span class="hp-left">Sinh lực còn lại bảo lưu cho hiệp sau: <b>${remainingHp} HP</b></span>
        </div>
      `;
    } else {
      this.roundOverWinner.innerHTML = `<div class="round-winner-card"><h3>⚖️ HAI BÊN CÙNG BỊ TIÊU DIỆT (HÒA)!</h3></div>`;
    }

    this.renderRosterPreview(this.roundOverP1Roster, this.manager.p1Roster);
    this.renderRosterPreview(this.roundOverP2Roster, this.manager.p2Roster);
  }

  private showMatchOverModal(winnerIdx: 1 | 2) {
    this.matchOverModal.classList.remove('hidden');
    const isMe = winnerIdx === this.manager.myPlayerIdx;
    this.matchOverTitle.innerText = isMe ? '👑 BẠN LÀ NHÀ VÔ ĐỊCH 👑' : '💀 THẤT BẠI CHUNG CUỘC 💀';

    this.matchOverWinner.innerHTML = `
      <div class="match-trophy-display">
        <span class="trophy-emoji">${isMe ? '🏆' : '💀'}</span>
        <h2>${isMe ? 'CHÚC MỪNG BẠN LÀ NHÀ VÔ ĐỊCH!' : 'ĐỐI THỦ ĐÃ GIÀNH CHIẾN THẮNG CHUNG CUỘC!'}</h2>
        <p>${isMe ? 'Bạn đã quét sạch toàn bộ 3 đấu sĩ của đối phương!' : 'Toàn bộ 3 đấu sĩ của bạn đã bị hạ gục.'}</p>
      </div>
    `;
  }

  private renderRosterPreview(container: HTMLElement, roster: Array<{ heroId: BallTypeId; isDead: boolean; currentHp: number }>) {
    container.innerHTML = '';
    for (const item of roster) {
      const cfg = BALL_CONFIGS[item.heroId];
      const pill = document.createElement('div');
      pill.className = `roster-pill ${item.isDead ? 'dead' : 'alive'}`;
      pill.innerHTML = `
        <span>${cfg.skin.icon}</span>
        <strong>${cfg.skin.vietnameseName}</strong>
        <small>${item.isDead ? '💀' : `${item.currentHp} HP`}</small>
      `;
      container.appendChild(pill);
    }
  }

  public update() {
    if (this.manager.onlinePhase === 'BATTLE') {
      this.updateBattleHUD();
    }
  }
}
