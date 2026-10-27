import type { GameEngine } from '../core/GameEngine';
import type { Ball } from '../entities/Ball';
import { BALL_CONFIGS, HERO_EXTRA_META } from '../entities/BallTypes';
import { soundFX } from '../audio/SoundFX';
import type { BallTypeId } from '../types';

export class PlayerSlotUI {
  public readonly playerIdx: 1 | 2;
  private readonly engine: GameEngine;
  private readonly onDismissModal: () => void;

  // DOM Elements
  private readonly panel: HTMLElement;
  private readonly setupSection: HTMLElement;
  private readonly battleSection: HTMLElement;
  private readonly tableContainer: HTMLElement;
  private readonly heroPreview: HTMLElement;
  private readonly angleSlider: HTMLInputElement;
  private readonly btnRandomAngle: HTMLButtonElement;
  private readonly angleVal: HTMLElement;
  private readonly statusBadge: HTMLElement;
  private readonly btnReady: HTMLButtonElement;
  private readonly hudHeroCard: HTMLElement;
  private readonly liveHpText: HTMLElement;
  private readonly liveHpBar: HTMLElement;
  private readonly liveSkillName: HTMLElement;
  private readonly liveSkillStatus: HTMLElement;
  private readonly liveSkillBar: HTMLElement;
  private readonly liveDmg: HTMLElement;
  private readonly liveBounces: HTMLElement;
  private readonly liveSpeed: HTMLElement;
  private readonly btnReaim: HTMLButtonElement;
  private readonly btnRematch: HTMLButtonElement;
  private readonly presets: NodeListOf<HTMLButtonElement>;
  private readonly sideTab: HTMLElement | null;
  private isSideTabOpen: boolean = false;

  // Dirty checking cache
  private lastView: 'setup' | 'battle' | null = null;
  private lastSelectedTypeId: BallTypeId | null = null;
  private lastAimAngleDeg: number | null = null;
  private lastIsReady: boolean | null = null;

  // Live HUD dirty checking
  private lastRenderedBallId: string | null = null;
  private lastIsDead: boolean | null = null;
  private lastHpText: string | null = null;
  private lastHpBarWidth: string | null = null;
  private lastHpBarClass: string | null = null;
  private lastSkillName: string | null = null;
  private lastSkillStatus: string | null = null;
  private lastSkillBarWidth: string | null = null;
  private lastSkillBarClass: string | null = null;
  private lastDmgText: string | null = null;
  private lastBouncesText: string | null = null;
  private lastSpeedText: string | null = null;

  constructor(playerIdx: 1 | 2, engine: GameEngine, onDismissModal: () => void) {
    this.playerIdx = playerIdx;
    this.engine = engine;
    this.onDismissModal = onDismissModal;

    const p = `p${playerIdx}`;

    this.panel = document.getElementById(`sandbox-${p}-panel`) as HTMLElement;
    this.setupSection = document.getElementById(`${p}-setup-section`) as HTMLElement;
    this.battleSection = document.getElementById(`${p}-battle-section`) as HTMLElement;
    this.tableContainer = document.getElementById(`${p}-table-container`) as HTMLElement;
    this.heroPreview = document.getElementById(`${p}-hero-preview`) as HTMLElement;
    this.angleSlider = document.getElementById(`${p}-angle-slider`) as HTMLInputElement;
    this.btnRandomAngle = document.getElementById(`btn-${p}-random-angle`) as HTMLButtonElement;
    this.angleVal = document.getElementById(`${p}-angle-val`) as HTMLElement;
    this.statusBadge = document.getElementById(`${p}-status-badge`) as HTMLElement;
    this.btnReady = document.getElementById(`btn-${p}-ready`) as HTMLButtonElement;
    this.hudHeroCard = document.getElementById(`${p}-hud-hero-card`) as HTMLElement;
    this.liveHpText = document.getElementById(`${p}-live-hp-text`) as HTMLElement;
    this.liveHpBar = document.getElementById(`${p}-live-hp-bar`) as HTMLElement;
    this.liveSkillName = document.getElementById(`${p}-live-skill-name`) as HTMLElement;
    this.liveSkillStatus = document.getElementById(`${p}-live-skill-status`) as HTMLElement;
    this.liveSkillBar = document.getElementById(`${p}-live-skill-bar`) as HTMLElement;
    this.liveDmg = document.getElementById(`${p}-live-dmg`) as HTMLElement;
    this.liveBounces = document.getElementById(`${p}-live-bounces`) as HTMLElement;
    this.liveSpeed = document.getElementById(`${p}-live-speed`) as HTMLElement;
    this.btnReaim = document.getElementById(`btn-${p}-reaim`) as HTMLButtonElement;
    this.btnRematch = document.getElementById(`btn-${p}-rematch`) as HTMLButtonElement;
    this.presets = this.setupSection.querySelectorAll<HTMLButtonElement>('.btn-preset');
    this.sideTab = document.getElementById(`p${playerIdx}-hero-side-tab`);

    this.bindEvents();
    this.renderHeroTable();
  }

  public getBall(): Ball | null {
    return this.playerIdx === 1 ? this.engine.p1Ball : this.engine.p2Ball;
  }

  public setVisible(visible: boolean): void {
    this.panel.classList.toggle('hidden', !visible);
    if (!visible) {
      this.closeSideTab();
    }
  }

  public resetStateCache(): void {
    this.closeSideTab();
    this.lastView = null;
    this.lastSelectedTypeId = null;
    this.lastAimAngleDeg = null;
    this.lastIsReady = null;
    this.lastRenderedBallId = null;
    this.lastIsDead = null;
    this.lastHpText = null;
    this.lastHpBarWidth = null;
    this.lastHpBarClass = null;
    this.lastSkillName = null;
    this.lastSkillStatus = null;
    this.lastSkillBarWidth = null;
    this.lastSkillBarClass = null;
    this.lastDmgText = null;
    this.lastBouncesText = null;
    this.lastSpeedText = null;
  }

  public renderHeroTable(): void {
    this.tableContainer.innerHTML = '';
    const types = Object.keys(BALL_CONFIGS) as BallTypeId[];

    const list = document.createElement('div');
    list.className = 'hero-roster-list';

    types.forEach((typeId) => {
      const cfg = BALL_CONFIGS[typeId];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'roster-row';
      row.dataset.type = typeId;
      row.setAttribute('title', `${cfg.skin.vietnameseName} (${cfg.skin.name}) - ${cfg.skill.vietnameseName}`);
      row.style.setProperty('--row-glow', cfg.skin.glowColor);
      row.style.setProperty('--row-pcolor', cfg.skin.primaryColor);

      row.innerHTML = `
        <span class="table-sphere">${cfg.skin.icon}</span>
        <div class="roster-card-info">
          <strong class="vn-name">${cfg.skin.vietnameseName}</strong>
          <span class="roster-meta-tags">
            <span class="mini-hp">${cfg.baseHp} HP</span>
            <span class="mini-dot">·</span>
            <span class="mini-atk ${typeId === 'BLAZE' ? 'atk-scale' : ''}">${typeId === 'BLAZE' ? '10+' : cfg.baseAttack} ATK</span>
          </span>
        </div>
      `;

      row.addEventListener('click', () => {
        this.engine.setSandboxBallType(this.playerIdx, typeId);
        soundFX.playAimTick();
        this.lastSelectedTypeId = null;
        this.updateSetupUI();
      });

      list.appendChild(row);
    });

    this.tableContainer.appendChild(list);
  }

  private bindEvents(): void {
    // Slider Angle
    this.angleSlider.addEventListener('input', () => {
      if (this.engine.winner || this.engine.isDraw) {
        this.onDismissModal();
        this.engine.resetSandboxAim(false);
      }
      const deg = parseFloat(this.angleSlider.value);
      this.engine.setSandboxAngle(this.playerIdx, (deg * Math.PI) / 180);
    });

    this.btnRandomAngle.addEventListener('click', () => {
      if (this.engine.winner || this.engine.isDraw) {
        this.onDismissModal();
        this.engine.resetSandboxAim(false);
      }
      const ball = this.getBall();
      if (ball && !ball.isReady && this.engine.sandboxPhase === 'AIMING') {
        const deg = Math.floor(Math.random() * 360);
        this.engine.setSandboxAngle(this.playerIdx, (deg * Math.PI) / 180);
        soundFX.playAimTick();
      }
    });

    // Angle Preset Buttons
    this.presets.forEach((btn) => {
      btn.addEventListener('click', () => {
        const deg = parseFloat(btn.dataset.angle || '0');
        if (this.engine.winner || this.engine.isDraw) {
          this.onDismissModal();
          this.engine.resetSandboxAim(false);
        }
        const ball = this.getBall();
        if (ball && !ball.isReady && this.engine.sandboxPhase === 'AIMING') {
          this.engine.setSandboxAngle(this.playerIdx, (deg * Math.PI) / 180);
          soundFX.playAimTick();
        }
      });
    });

    // Ready Button
    this.btnReady.addEventListener('click', () => {
      const ball = this.getBall();
      if (ball) {
        if (this.engine.winner || this.engine.isDraw) {
          this.onDismissModal();
          this.engine.resetSandboxAim(false);
          return;
        }
        this.closeSideTab();
        this.engine.setSandboxPlayerReady(this.playerIdx, !ball.isReady);
      }
    });

    // Reaim & Rematch (in HUD)
    this.btnReaim.addEventListener('click', () => {
      this.closeSideTab();
      this.onDismissModal();
      this.resetStateCache();
      this.engine.resetSandboxAim(false);
    });

    this.btnRematch.addEventListener('click', () => {
      this.closeSideTab();
      this.onDismissModal();
      this.resetStateCache();
      this.engine.resetSandboxAim(true);
    });

    // Close side tab when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.isSideTabOpen) return;
      const target = e.target as HTMLElement;
      if (
        this.sideTab &&
        !this.sideTab.contains(target) &&
        !this.heroPreview.contains(target) &&
        !this.tableContainer.contains(target)
      ) {
        this.closeSideTab();
      }
    });

    // Close side tab on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSideTabOpen) {
        this.closeSideTab();
      }
    });
  }

  public update(isBattlePhase: boolean): void {
    const ball = this.getBall();
    if (!ball) return;

    if (isBattlePhase && this.isSideTabOpen) {
      this.closeSideTab();
    }

    if (!isBattlePhase) {
      if (this.lastView !== 'setup') {
        this.lastView = 'setup';
        this.setupSection.classList.remove('hidden');
        this.battleSection.classList.add('hidden');
      }
      this.updateSetupUI(ball);
    } else {
      if (this.lastView !== 'battle') {
        this.lastView = 'battle';
        this.setupSection.classList.add('hidden');
        this.battleSection.classList.remove('hidden');
      }
      this.updateBattleUI(ball);
    }
  }

  private updateSetupUI(ballOverride?: Ball): void {
    const ball = ballOverride ?? this.getBall();
    if (!ball) return;

    // 0. Ensure hero roster table DOM exists
    if (!this.tableContainer.querySelector('.hero-roster-list')) {
      this.renderHeroTable();
    }

    // 1. Roster Selection & Hero Preview
    if (this.lastSelectedTypeId !== ball.typeId || !this.heroPreview.querySelector('.compact-preview-card')) {
      this.lastSelectedTypeId = ball.typeId;
      const rows = this.tableContainer.querySelectorAll<HTMLButtonElement>('.roster-row');
      rows.forEach((el) => {
        const isMatch = el.dataset.type === ball.typeId;
        el.classList.toggle('selected', isMatch);
        el.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
      this.updateHeroPreview(ball);
    }

    // 2. Aim Angle
    const pDeg = Math.round((((ball.aimAngle * 180) / Math.PI) % 360 + 360) % 360);
    if (this.lastAimAngleDeg !== pDeg) {
      this.lastAimAngleDeg = pDeg;
      this.angleVal.innerText = `${pDeg}°`;
      if (document.activeElement !== this.angleSlider) {
        this.angleSlider.value = pDeg.toString();
      }
      this.presets.forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.dataset.angle || '-1') === pDeg);
      });
    }

    // 3. Ready State
    if (this.lastIsReady !== ball.isReady) {
      this.lastIsReady = ball.isReady;
      this.statusBadge.className = `badge ${ball.isReady ? 'ready' : 'not-ready'}`;
      this.statusBadge.innerText = ball.isReady ? '🟢 ĐÃ SẴN SÀNG' : '🔴 Chưa sẵn sàng';

      this.btnReady.className = `btn-ready ${ball.isReady ? 'active' : ''}`;
      this.btnReady.innerText = ball.isReady
        ? `↩️ Hủy Sẵn Sàng ${this.playerIdx}`
        : `✅ Xác Nhận Sẵn Sàng ${this.playerIdx}`;
      this.angleSlider.disabled = ball.isReady;
      this.btnRandomAngle.disabled = ball.isReady;
    }
  }

  public toggleSideTab(forceOpen?: boolean): void {
    if (forceOpen !== undefined) {
      this.isSideTabOpen = forceOpen;
    } else {
      this.isSideTabOpen = !this.isSideTabOpen;
    }

    if (this.isSideTabOpen) {
      this.renderSideTab();
      this.sideTab?.classList.remove('hidden');
      soundFX.playAimTick();
    } else {
      this.sideTab?.classList.add('hidden');
    }

    const toggleBtn = this.heroPreview.querySelector<HTMLElement>('.btn-dossier-toggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isSideTabOpen);
      toggleBtn.innerHTML = this.isSideTabOpen
        ? 'Đóng <span class="toggle-icon">✕</span>'
        : 'Chi tiết <span class="toggle-icon">↗</span>';
    }
  }

  public closeSideTab(): void {
    if (this.isSideTabOpen) {
      this.toggleSideTab(false);
    }
  }

  private renderSideTab(): void {
    const ball = this.getBall();
    if (!ball || !this.sideTab) return;

    const cfg = BALL_CONFIGS[ball.typeId];
    const meta = HERO_EXTRA_META[ball.typeId];

    this.sideTab.style.setProperty('--hero-theme', cfg.skin.glowColor);
    this.sideTab.innerHTML = `
      <div class="side-tab-header">
        <div class="side-tab-title-wrap">
          <span class="side-tab-badge">📋 HỒ SƠ ĐẤU SĨ ${this.playerIdx}</span>
          <span class="side-tab-subtitle">Chi tiết kỹ năng & chiến thuật</span>
        </div>
        <button type="button" class="btn-side-tab-close" aria-label="Đóng hồ sơ">✕</button>
      </div>

      <div class="hero-dossier-top">
        <div class="dossier-avatar-orb">
          <span class="dossier-icon">${cfg.skin.icon}</span>
        </div>
        <div class="hero-dossier-names">
          <div class="dossier-title-row">
            <strong class="hero-dossier-name">${cfg.skin.vietnameseName}</strong>
            <span class="hero-dossier-en">${cfg.skin.name}</span>
          </div>
          <span class="hero-role-pill" style="border-color: ${meta.roleColor}55; background: ${meta.roleColor}18; color: ${meta.roleColor}">
            ${meta.role}
          </span>
        </div>
      </div>

      <div class="hero-stats-row">
        <div class="stat-chip">
          <span class="stat-lbl">❤️ SINH LỰC</span>
          <strong class="stat-val">${cfg.baseHp} <small>HP</small></strong>
        </div>
        <div class="stat-chip">
          <span class="stat-lbl">⚔️ SÁT THƯƠNG</span>
          <strong class="stat-val ${ball.typeId === 'BLAZE' ? 'atk-scale-text' : ''}">${cfg.baseAttack}${ball.typeId === 'BLAZE' ? '+' : ''} <small>ATK</small></strong>
        </div>
        <div class="stat-chip">
          <span class="stat-lbl">⏱️ HỒI CHIÊU</span>
          <strong class="stat-val">${cfg.skill.cooldown}s <small>CD</small></strong>
        </div>
      </div>

      <div class="hero-skill-compact">
        <div class="skill-head">
          <span class="skill-name">⚡ ${cfg.skill.vietnameseName}</span>
          <span class="skill-sub">${cfg.skill.cooldown}s Hồi Chiêu · ${cfg.skill.duration}s Hiệu Lực</span>
        </div>
        <p class="skill-text">${cfg.skill.description}</p>
      </div>

      <div class="hero-tactic-compact">
        <span class="tactic-bulb">💡</span>
        <div class="tactic-content">
          <span class="tactic-head">Mẹo Tác Chiến</span>
          <p class="tactic-text">${meta.tactics}</p>
        </div>
      </div>
    `;

    const closeBtn = this.sideTab.querySelector<HTMLButtonElement>('.btn-side-tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSideTab();
      });
    }
  }

  private updateHeroPreview(ball: Ball): void {
    const cfg = BALL_CONFIGS[ball.typeId];
    const meta = HERO_EXTRA_META[ball.typeId];

    this.heroPreview.classList.add('is-open');
    this.heroPreview.style.setProperty('--hero-theme', cfg.skin.glowColor);
    this.heroPreview.innerHTML = `
      <div class="compact-preview-card" role="button" tabindex="0" title="Bấm để xem hồ sơ kỹ năng & mẹo tác chiến chi tiết">
        <div class="compact-preview-main">
          <div class="compact-avatar-orb">
            <span class="compact-icon">${cfg.skin.icon}</span>
          </div>
          <div class="compact-info">
            <div class="compact-title-row">
              <strong class="compact-name">${cfg.skin.vietnameseName}</strong>
              <span class="compact-role" style="color: ${meta.roleColor}; background: ${meta.roleColor}1a; border-color: ${meta.roleColor}40;">
                ${meta.role}
              </span>
            </div>
            <div class="compact-quick-stats">
              <span class="c-stat hp">❤️ ${cfg.baseHp}</span>
              <span class="c-dot">·</span>
              <span class="c-stat atk">⚔️ ${cfg.baseAttack}${ball.typeId === 'BLAZE' ? '+' : ''}</span>
              <span class="c-dot">·</span>
              <span class="c-stat skill">⚡ ${cfg.skill.vietnameseName}</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-dossier-toggle ${this.isSideTabOpen ? 'active' : ''}" aria-label="Xem chi tiết tướng">
          ${this.isSideTabOpen ? 'Đóng <span class="toggle-icon">✕</span>' : 'Chi tiết <span class="toggle-icon">↗</span>'}
        </button>
      </div>
    `;

    const card = this.heroPreview.querySelector<HTMLElement>('.compact-preview-card');
    if (card) {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSideTab();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.toggleSideTab();
        }
      });
    }

    if (this.isSideTabOpen) {
      this.renderSideTab();
    }
  }

  private updateBattleUI(ball: Ball): void {
    // 1. Status Badge
    if (this.lastIsDead !== ball.isDead) {
      this.lastIsDead = ball.isDead;
      this.statusBadge.className = `badge ${ball.isDead ? 'not-ready' : 'ready'}`;
      this.statusBadge.innerText = ball.isDead ? '💀 ĐÃ BỊ HẠ GỤC' : '⚔️ ĐANG CHIẾN ĐẤU';
    }

    // 2. HUD Hero Card
    this.renderLiveHUDHeroCard(ball);

    // 3. Live HP Bar & Text with Dirty Checking
    const hpPct = Math.max(0, Math.min(100, (ball.hp / ball.maxHp) * 100));
    const hpWidth = `${hpPct}%`;
    const overhealText = ball.hp > ball.maxHp ? ` (+${Math.ceil(ball.hp - ball.maxHp)} 🩸)` : '';
    const hpText = `${Math.ceil(ball.hp)} / ${ball.maxHp} HP${overhealText}`;
    const hpClass = `hud-bar-fill hp-fill ${ball.hp > ball.maxHp ? 'overheal' : hpPct < 25 ? 'danger' : hpPct < 50 ? 'warn' : ''}`;

    if (this.lastHpBarWidth !== hpWidth) {
      this.lastHpBarWidth = hpWidth;
      this.liveHpBar.style.width = hpWidth;
    }
    if (this.lastHpText !== hpText) {
      this.lastHpText = hpText;
      this.liveHpText.innerText = hpText;
    }
    if (this.lastHpBarClass !== hpClass) {
      this.lastHpBarClass = hpClass;
      this.liveHpBar.className = hpClass;
    }

    // 4. Live Skill Status & Bar with Dirty Checking
    const isGoku = ball.typeId === 'GOKU';
    const skillName = isGoku ? '🐉 NỘ KHÍ' : `⚡ ${ball.skill.vietnameseName}`;
    if (this.lastSkillName !== skillName) {
      this.lastSkillName = skillName;
      this.liveSkillName.innerText = skillName;
    }

    let skillStatus: string;
    let skillWidth: string;
    let skillClass: string;

    if (isGoku) {
      const ragePct = Math.max(0, Math.min(100, ball.gokuRage));
      skillStatus = ball.isFrozen()
        ? `❄️ BỊ ĐÓNG BĂNG! · ${ragePct.toFixed(0)}%`
        : `🐉 ${ragePct.toFixed(0)}% · Kamehameha: ${Math.round((16 + (90 - 16) * ragePct / 100) * 0.7)} sát thương`;
      skillWidth = `${ragePct}%`;
      skillClass = `hud-bar-fill skill-fill ${ragePct >= 100 ? 'ready-glow' : 'charging'}`;
    } else if (ball.isFrozen()) {
      skillStatus = '❄️ BỊ ĐÓNG BĂNG!';
      skillWidth = this.lastSkillBarWidth ?? '0%';
      skillClass = 'hud-bar-fill skill-fill frozen';
    } else if (ball.isSkillActive) {
      skillStatus = `🔥 KÍCH HOẠT (${ball.skillActiveTimer.toFixed(1)}s)`;
      skillWidth = '100%';
      skillClass = 'hud-bar-fill skill-fill active-glow';
    } else if (ball.cooldownTimer <= 0) {
      skillStatus = '⚡ SẴN SÀNG!';
      skillWidth = '100%';
      skillClass = 'hud-bar-fill skill-fill ready-glow';
    } else {
      const cdPct = Math.max(0, Math.min(100, ((ball.skill.cooldown - ball.cooldownTimer) / ball.skill.cooldown) * 100));
      skillStatus = `Nạp ${cdPct.toFixed(0)}% (${ball.cooldownTimer.toFixed(1)}s)`;
      skillWidth = `${cdPct}%`;
      skillClass = 'hud-bar-fill skill-fill charging';
    }

    if (this.lastSkillStatus !== skillStatus) {
      this.lastSkillStatus = skillStatus;
      this.liveSkillStatus.innerText = skillStatus;
    }
    if (this.lastSkillBarWidth !== skillWidth) {
      this.lastSkillBarWidth = skillWidth;
      this.liveSkillBar.style.width = skillWidth;
    }
    if (this.lastSkillBarClass !== skillClass) {
      this.lastSkillBarClass = skillClass;
      this.liveSkillBar.className = skillClass;
    }

    // 5. Live Stats with Dirty Checking
    const dmgText = Math.round(ball.damageDealt).toString();
    if (this.lastDmgText !== dmgText) {
      this.lastDmgText = dmgText;
      this.liveDmg.innerText = dmgText;
    }

    const bouncesText = ball.bounces.toString();
    if (this.lastBouncesText !== bouncesText) {
      this.lastBouncesText = bouncesText;
      this.liveBounces.innerText = bouncesText;
    }

    const speedText = Math.round(Math.hypot(ball.vx, ball.vy)).toString();
    if (this.lastSpeedText !== speedText) {
      this.lastSpeedText = speedText;
      this.liveSpeed.innerText = speedText;
    }
  }

  private renderLiveHUDHeroCard(ball: Ball): void {
    if (this.lastRenderedBallId === ball.id) return;
    this.lastRenderedBallId = ball.id;

    const cfg = BALL_CONFIGS[ball.typeId];
    const meta = HERO_EXTRA_META[ball.typeId];
    this.hudHeroCard.style.setProperty('--hud-theme', cfg.skin.glowColor);

    this.hudHeroCard.innerHTML = `
      <div class="hud-hero-left">
        <span class="hud-avatar">${cfg.skin.icon}</span>
        <div class="hud-names">
          <strong class="hud-name">${cfg.skin.vietnameseName}</strong>
          <span class="hud-en">${cfg.skin.name}</span>
        </div>
      </div>
      <span class="hud-role-pill" style="border-color: ${meta.roleColor}50; background: ${meta.roleColor}1a; color: ${meta.roleColor}">
        ${meta.role}
      </span>
    `;
  }
}
