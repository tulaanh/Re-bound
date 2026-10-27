import { BoxArena } from '../physics/Box';
import { CollisionResolver } from '../physics/Collision';
import { Ball } from '../entities/Ball';
import { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';
import { HazardManager } from '../hazards';
import { VOID_SKILL_RADIUS } from '../skills/VoidSkill';
import type { GameMode, SandboxPhase, BallTypeId, FrostZone, ToxicPool, LightningHazard, MeteorImpact } from '../types';

interface ThrownDagger {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  life: number;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public box: BoxArena;
  public vfx: ParticleSystem;
  public hazardManager = new HazardManager();
  public balls: Ball[] = [];
  private daggers: { x: number; y: number }[] = [];
  private thrownDaggers: ThrownDagger[] = [];

  public get frostZones(): FrostZone[] {
    return this.hazardManager.frostZones;
  }
  public get toxicPools(): ToxicPool[] {
    return this.hazardManager.toxicPools;
  }
  public get lightningHazards(): LightningHazard[] {
    return this.hazardManager.lightningHazards;
  }
  public get meteorImpacts(): MeteorImpact[] {
    return this.hazardManager.meteorImpacts;
  }

  public gameMode: GameMode = 'BATTLE';
  public isPaused: boolean = false;
  public timeScale: number = 1.0;
  public winner: Ball | null = null;
  public isDraw: boolean = false;
  public matchEndHandled: boolean = false;

  // Sandbox Duel state
  public sandboxPhase: SandboxPhase = 'SELECTING_BALLS';
  public countdownTimer: number = 0;
  private lastCountdownSec: number = -1;
  public p1Ball: Ball | null = null;
  public p2Ball: Ball | null = null;
  private draggingBall: Ball | null = null;

  // Online Duel state
  public onlineLocalPlayerIdx: 1 | 2 = 1;
  public onOnlineAimChanged?: (angle: number) => void;

  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private subSteps: number = 4; // Physics sub-stepping prevents tunneling

  public onUpdateUI?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context from canvas');
    this.ctx = ctx;

    const initialSize = 480;
    this.box = new BoxArena(canvas.width / 2, canvas.height / 2, initialSize);
    this.vfx = new ParticleSystem();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initPointerEvents();
  }

  public resize() {
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : { width: 700, height: 700 };
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(Math.floor(rect.width), 320);
    const displayHeight = Math.max(Math.floor(rect.height), 320);

    const oldCenterX = this.box ? this.box.centerX : displayWidth / 2;
    const oldCenterY = this.box ? this.box.centerY : displayHeight / 2;
    const oldSize = this.box && this.box.size > 0 ? this.box.size : 480;

    this.canvas.width = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;

    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    // Kích thước chuẩn ổn định của sàn đấu (không bị phình to hoặc co bất thường khi zoom)
    const STANDARD_BOX_SIZE = 480;

    // Khoảng trống an toàn tránh thanh Stepper ở trên (~60px) và thanh hành động ở dưới (~75px)
    const availableW = Math.max(200, displayWidth - 40);
    const availableH = Math.max(200, displayHeight - 145);

    // Tính toán theo đường chéo khi xoay hộp (diagonal = size * sqrt(2)) để không chạm UI
    const maxSafeRotatedSize = Math.floor(Math.min(availableW, availableH) / Math.SQRT2);

    // Kích thước cuối: cố định ở STANDARD_BOX_SIZE, chỉ tự động co nhỏ an toàn khi màn hình quá hẹp
    const boxSize = Math.max(240, Math.min(STANDARD_BOX_SIZE, maxSafeRotatedSize));
    const newCenterX = displayWidth / 2;
    const newCenterY = displayHeight / 2;

    if (this.box) {
      this.box.resize(newCenterX, newCenterY, boxSize);
    }

    // ALWAYS keep balls correctly positioned relative to the box!
    if ((this.gameMode === 'SANDBOX' || this.gameMode === 'ONLINE_DUEL') && (this.sandboxPhase === 'SELECTING_BALLS' || this.sandboxPhase === 'AIMING' || this.sandboxPhase === 'COUNTDOWN' || this.countdownTimer > 0)) {
      this.repositionSandboxBalls();
    } else if (oldSize > 1) {
      // In BATTLE mode or active combat, scale all existing balls and floor zones to new box coordinates!
      const scaleFactor = boxSize / oldSize;
      for (const b of this.balls) {
        b.x = newCenterX + (b.x - oldCenterX) * scaleFactor;
        b.y = newCenterY + (b.y - oldCenterY) * scaleFactor;
        b.spawnX = newCenterX + (b.spawnX - oldCenterX) * scaleFactor;
        b.spawnY = newCenterY + (b.spawnY - oldCenterY) * scaleFactor;
      }
      this.hazardManager.onBoxResize(oldCenterX, oldCenterY, oldSize, newCenterX, newCenterY, boxSize);
      for (const b of this.balls) {
        for (const pt of b.voltEmittingPoints) {
          pt.x = newCenterX + (pt.x - oldCenterX) * scaleFactor;
          pt.y = newCenterY + (pt.y - oldCenterY) * scaleFactor;
        }
      }
    }
  }

  public start() {
    this.resize();
    this.resetMatch();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    this.winner = null;
    this.isDraw = false;
    this.matchEndHandled = false;

    if (mode === 'SANDBOX') {
      this.initSandboxDuel();
    } else if (mode === 'BATTLE') {
      this.resetMatch();
    } else if (mode === 'ONLINE_DUEL') {
      this.balls = [];
      this.daggers = [];
      this.thrownDaggers = [];
      this.hazardManager.clear();
      this.vfx.clear();
      this.p1Ball = null;
      this.p2Ball = null;
    }

    if (this.onUpdateUI) this.onUpdateUI();
  }

  public togglePause(): boolean {
    this.isPaused = !this.isPaused;
    if (this.onUpdateUI) this.onUpdateUI();
    return this.isPaused;
  }

  public setTimeScale(scale: number) {
    this.timeScale = scale;
    if (this.onUpdateUI) this.onUpdateUI();
  }

  public toggleRotation(): boolean {
    this.box.isRotating = !this.box.isRotating;
    if (this.onUpdateUI) this.onUpdateUI();
    return this.box.isRotating;
  }

  public createFrostZone(ownerId: string, x: number, y: number, radius: number = 90, duration: number = 5) {
    this.hazardManager.createFrostZone(ownerId, x, y, radius, duration);
  }

  public createToxicPools(ownerId: string, pools: { x: number; y: number; radius: number; duration: number }[]) {
    this.hazardManager.createToxicPools(ownerId, pools, this.box.size, this.box.centerX, this.box.centerY, this.vfx);
  }

  public createLightningHazard(ownerId: string, points: { x: number; y: number }[], duration: number = 1.5) {
    this.hazardManager.createLightningHazard(ownerId, points, duration);
  }

  private attachBallEvents(ball: Ball) {
    ball.onSpawnFrostZone = (owner, x, y, r, d) => this.createFrostZone(owner.id, x, y, r, d);
    ball.onSpawnToxicPools = (owner, pools) => this.createToxicPools(owner.id, pools);
    ball.onSpawnLightningHazard = (owner, points, duration) => this.createLightningHazard(owner.id, points, duration);
    ball.onSpawnMeteorShower = (owner) => this.createMeteorShower(owner);
    ball.onSpawnMinion = (minion) => {
      this.attachBallEvents(minion);
      this.balls.push(minion);
    };
  }

  /** Split each dead Slime once, up to three generations. */
  private processSlimeSplits(): void {
    const deadSlimes = this.balls.filter(
      (ball) => ball.typeId === 'SLIME' && ball.isDead && !ball.slimeSplitProcessed
    );

    for (const parent of deadSlimes) {
      parent.slimeSplitProcessed = true;
      if (parent.slimeSplitCount >= Ball.MAX_SLIME_SPLITS) continue;

      const nextSplitCount = parent.slimeSplitCount + 1;
      const childRadius = Math.max(10, parent.radius * 0.7);
      const childMaxHp = Math.max(1, Math.round(parent.maxHp * 0.4));
      const movementAngle = Math.hypot(parent.vx, parent.vy) > 0.01
        ? Math.atan2(parent.vy, parent.vx)
        : Math.random() * Math.PI * 2;
      const childSpeed = Math.max(120, Math.hypot(parent.vx, parent.vy) * 0.85);
      const spawnDistance = parent.radius + childRadius + 4;

      for (const side of [-1, 1]) {
        const angle = movementAngle + side * 0.6;
        const child = new Ball(
          'SLIME',
          parent.x + Math.cos(angle) * spawnDistance,
          parent.y + Math.sin(angle) * spawnDistance,
          Math.cos(angle) * childSpeed,
          Math.sin(angle) * childSpeed
        );

        child.slimeSplitCount = nextSplitCount;
        child.radius = childRadius;
        child.mass = (childRadius * childRadius) / 400;
        child.maxHp = childMaxHp;
        child.hp = childMaxHp;
        child.baseAttack = Math.max(1, parent.baseAttack - 2);
        child.targetSpeed = parent.targetSpeed;
        child.baseTargetSpeed = parent.baseTargetSpeed;

        this.attachBallEvents(child);
        this.balls.push(child);
        this.vfx.emitShockwaveRing(child.x, child.y, child.skin.glowColor, 42, 0.35);
        this.vfx.emitSparks(child.x, child.y, child.skin.primaryColor, 10, 140);
      }

      this.vfx.addFloatingText(
        parent.x,
        parent.y - parent.radius - 12,
        `🟢 TÁCH ĐÔI! (${nextSplitCount}/${Ball.MAX_SLIME_SPLITS})`,
        '#bef264',
        18
      );
      this.vfx.triggerScreenShake(6);
    }
  }

  public createMeteorShower(owner: Ball) {
    this.hazardManager.createMeteorShower(owner, this.box.size, this.box.centerX, this.box.centerY, this.box.angle);
  }

  public spawnBall(typeId: BallTypeId): Ball {
    const half = Math.max(25, this.box.size * 0.3);
    const spawnX = this.box.centerX + (Math.random() - 0.5) * half * 1.5;
    const spawnY = this.box.centerY + (Math.random() - 0.5) * half * 1.5;

    const ball = new Ball(typeId, spawnX, spawnY);
    this.attachBallEvents(ball);
    this.balls.push(ball);

    this.vfx.emitShockwaveRing(ball.x, ball.y, ball.skin.glowColor, 60, 0.4);
    this.vfx.emitSparks(ball.x, ball.y, ball.skin.primaryColor, 15, 180);

    if (this.winner) {
      this.winner = null;
      this.isDraw = false;
      this.matchEndHandled = false;
    }

    if (this.onUpdateUI) this.onUpdateUI();
    return ball;
  }

  public resetMatch() {
    this.balls = [];
    this.daggers = [];
    this.thrownDaggers = [];
    this.hazardManager.clear();
    this.vfx.clear();
    this.winner = null;
    this.isDraw = false;
    this.matchEndHandled = false;
    this.p1Ball = null;
    this.p2Ball = null;

    if (this.gameMode === 'SANDBOX') {
      this.initSandboxDuel();
      return;
    }

    // Random 4 distinct heroes for Battle Mode
    const allAvailableTypes: BallTypeId[] = ['BLAZE', 'FROST', 'VOLT', 'VOID', 'TOXIC', 'VAMPIRE', 'METEOR', 'AXE', 'NECRO', 'SLIME', 'GOKU', 'CLOWN', 'TITAN', 'WOOD', 'DAGGER', 'SPIDER'];
    const chosenTypes = [...allAvailableTypes].sort(() => Math.random() - 0.5).slice(0, 4);
    chosenTypes.forEach((type, idx) => {
      const angle = (idx / chosenTypes.length) * Math.PI * 2;
      const dist = this.box.size * 0.28;
      const x = this.box.centerX + Math.cos(angle) * dist;
      const y = this.box.centerY + Math.sin(angle) * dist;

      const speed = 160;
      const vx = -Math.cos(angle + 0.3) * speed;
      const vy = -Math.sin(angle + 0.3) * speed;

      const ball = new Ball(type, x, y, vx, vy);
      this.attachBallEvents(ball);
      this.balls.push(ball);
    });

    if (this.onUpdateUI) this.onUpdateUI();
  }

  // ==========================================
  // SANDBOX AIM & DUEL SYSTEM
  // ==========================================

  public initSandboxDuel(type1: BallTypeId = 'BLAZE', type2: BallTypeId = 'FROST') {
    this.balls = [];
    this.daggers = [];
    this.thrownDaggers = [];
    this.hazardManager.clear();
    this.vfx.clear();
    this.winner = null;
    this.isDraw = false;
    this.matchEndHandled = false;
    this.sandboxPhase = 'AIMING'; // Unified Setup & Aiming phase
    this.countdownTimer = 0;
    this.lastCountdownSec = -1;

    const dist = this.box.size * 0.28;
    const y = this.box.centerY;

    // Ball 1 on the left side
    const x1 = this.box.centerX - dist;
    this.p1Ball = new Ball(type1, x1, y, 0, 0);
    this.attachBallEvents(this.p1Ball);
    this.p1Ball.isAiming = true;
    this.p1Ball.aimAngle = -0.15; // default angle
    this.p1Ball.isReady = false;

    // Ball 2 on the right side
    const x2 = this.box.centerX + dist;
    this.p2Ball = new Ball(type2, x2, y, 0, 0);
    this.attachBallEvents(this.p2Ball);
    this.p2Ball.isAiming = true;
    this.p2Ball.aimAngle = Math.PI + 0.15; // default angle
    this.p2Ball.isReady = false;

    this.balls = [this.p1Ball, this.p2Ball];
    if (this.onUpdateUI) this.onUpdateUI();
  }

  public confirmBallsAndProceedToAiming() {
    this.sandboxPhase = 'AIMING';
    if (this.p1Ball) {
      this.p1Ball.isAiming = true;
      this.p1Ball.isReady = false;
    }
    if (this.p2Ball) {
      this.p2Ball.isAiming = true;
      this.p2Ball.isReady = false;
    }
    if (this.onUpdateUI) this.onUpdateUI();
  }

  public backToBallSelection() {
    this.resetSandboxAim(false);
  }

  private repositionSandboxBalls() {
    if (!this.p1Ball || !this.p2Ball) return;
    const dist = this.box.size * 0.28;
    this.p1Ball.x = this.box.centerX - dist;
    this.p1Ball.y = this.box.centerY;
    this.p1Ball.spawnX = this.p1Ball.x;
    this.p1Ball.spawnY = this.p1Ball.y;

    this.p2Ball.x = this.box.centerX + dist;
    this.p2Ball.y = this.box.centerY;
    this.p2Ball.spawnX = this.p2Ball.x;
    this.p2Ball.spawnY = this.p2Ball.y;

    this.balls = [this.p1Ball, this.p2Ball];
  }

  public setSandboxBallType(playerIdx: 1 | 2, typeId: BallTypeId) {
    if (playerIdx === 1 && this.p1Ball) {
      this.p1Ball.skillStrategy.onBattleEnd?.(this.p1Ball, this.balls, this.vfx);
      const angle = this.p1Ball.aimAngle;
      this.p1Ball = new Ball(typeId, this.p1Ball.x, this.p1Ball.y, 0, 0);
      this.attachBallEvents(this.p1Ball);
      this.p1Ball.isAiming = true;
      this.p1Ball.aimAngle = angle;
      this.p1Ball.isReady = false;
      this.p1Ball.cooldownTimer = this.p1Ball.skill.cooldown;
      this.p1Ball.isSkillActive = false;
      this.balls = [this.p1Ball, this.p2Ball!];
    } else if (playerIdx === 2 && this.p2Ball) {
      this.p2Ball.skillStrategy.onBattleEnd?.(this.p2Ball, this.balls, this.vfx);
      const angle = this.p2Ball.aimAngle;
      this.p2Ball = new Ball(typeId, this.p2Ball.x, this.p2Ball.y, 0, 0);
      this.attachBallEvents(this.p2Ball);
      this.p2Ball.isAiming = true;
      this.p2Ball.aimAngle = angle;
      this.p2Ball.isReady = false;
      this.p2Ball.cooldownTimer = this.p2Ball.skill.cooldown;
      this.p2Ball.isSkillActive = false;
      this.balls = [this.p1Ball!, this.p2Ball];
    }
    if (this.onUpdateUI) this.onUpdateUI();
  }

  public setSandboxAngle(playerIdx: 1 | 2, angleRad: number) {
    const ball = playerIdx === 1 ? this.p1Ball : this.p2Ball;
    if (ball && !ball.isReady) {
      ball.aimAngle = angleRad;
      ball.facingAngle = angleRad;
      if (this.onUpdateUI) this.onUpdateUI();
    }
  }

  public setSandboxPlayerReady(playerIdx: 1 | 2, isReady: boolean) {
    if (this.sandboxPhase !== 'AIMING') {
      // If battle has ended or is in progress, clicking unlocks and resets to AIMING
      if (this.winner || this.isDraw || this.sandboxPhase === 'BATTLE') {
        this.resetSandboxAim(false);
        if (playerIdx === 1 && this.p1Ball) this.p1Ball.isReady = isReady;
        if (playerIdx === 2 && this.p2Ball) this.p2Ball.isReady = isReady;
        if (this.onUpdateUI) this.onUpdateUI();
      }
      return;
    }

    if (playerIdx === 1 && this.p1Ball) {
      this.p1Ball.isReady = isReady;
      soundFX.playWallBounce(1.5);
    } else if (playerIdx === 2 && this.p2Ball) {
      this.p2Ball.isReady = isReady;
      soundFX.playWallBounce(1.5);
    }

    // Check if both are ready!
    if (this.p1Ball?.isReady && this.p2Ball?.isReady) {
      this.sandboxPhase = 'COUNTDOWN';
      this.countdownTimer = 3.2; // 3 seconds countdown
      this.lastCountdownSec = 4;
      soundFX.playCountdownBeep(false);

      // Reset skill cooldowns and active states cleanly when countdown starts
      this.p1Ball.cooldownTimer = this.p1Ball.skill.cooldown;
      this.p2Ball.cooldownTimer = this.p2Ball.skill.cooldown;
      this.p1Ball.isSkillActive = false;
      this.p2Ball.isSkillActive = false;
    }

    if (this.onUpdateUI) this.onUpdateUI();
  }

  public resetSandboxAim(keepAnglesLocked: boolean = false) {
    if (!this.p1Ball || !this.p2Ball) {
      this.initSandboxDuel();
      return;
    }

    this.winner = null;
    this.isDraw = false;
    this.matchEndHandled = false;
    this.daggers = [];
    this.thrownDaggers = [];
    this.hazardManager.clear();

    // Clear skill-owned entities and restore temporary stat changes before resetting the duel.
    this.p1Ball.skillStrategy.onBattleEnd?.(this.p1Ball, this.balls, this.vfx);
    this.p2Ball.skillStrategy.onBattleEnd?.(this.p2Ball, this.balls, this.vfx);

    // Reset P1
    this.p1Ball.x = this.p1Ball.spawnX;
    this.p1Ball.y = this.p1Ball.spawnY;
    this.p1Ball.vx = 0;
    this.p1Ball.vy = 0;
    this.p1Ball.hp = this.p1Ball.maxHp;
    this.p1Ball.isDead = false;
    this.p1Ball.slimeSplitCount = 0;
    this.p1Ball.slimeSplitProcessed = false;
    this.p1Ball.isSkillActive = false;
    this.p1Ball.skillActiveTimer = 0;
    this.p1Ball.statusEffects = [];
    this.p1Ball.cooldownTimer = this.p1Ball.skill.cooldown;
    this.p1Ball.targetSpeed = this.p1Ball.baseTargetSpeed;
    this.p1Ball.voltEmittingPoints = [];
    this.p1Ball.voltHitCooldown = 0;
    this.p1Ball.latchedTargetId = null;
    this.p1Ball.latchedByVampireId = null;
    this.p1Ball.latchTimer = 0;
    this.p1Ball.latchCooldown = 0;
    this.p1Ball.latchDrainTimer = 0;
    this.p1Ball.axeAngle = 0;
    this.p1Ball.axeHitCooldowns = {};
    this.p1Ball.daggerStock = 0;
    this.p1Ball.daggerSpawnTimer = 0;
    this.p1Ball.daggerThrowTimer = 0;
    this.p1Ball.trail = [];
    this.p1Ball.bounces = 0;
    this.p1Ball.damageDealt = 0;
    this.p1Ball.kills = 0;
    this.p1Ball.facingAngle = this.p1Ball.aimAngle;

    // Reset P2
    this.p2Ball.x = this.p2Ball.spawnX;
    this.p2Ball.y = this.p2Ball.spawnY;
    this.p2Ball.vx = 0;
    this.p2Ball.vy = 0;
    this.p2Ball.hp = this.p2Ball.maxHp;
    this.p2Ball.isDead = false;
    this.p2Ball.slimeSplitCount = 0;
    this.p2Ball.slimeSplitProcessed = false;
    this.p2Ball.isSkillActive = false;
    this.p2Ball.skillActiveTimer = 0;
    this.p2Ball.statusEffects = [];
    this.p2Ball.cooldownTimer = this.p2Ball.skill.cooldown;
    this.p2Ball.targetSpeed = this.p2Ball.baseTargetSpeed;
    this.p2Ball.voltEmittingPoints = [];
    this.p2Ball.voltHitCooldown = 0;
    this.p2Ball.latchedTargetId = null;
    this.p2Ball.latchedByVampireId = null;
    this.p2Ball.latchTimer = 0;
    this.p2Ball.latchCooldown = 0;
    this.p2Ball.latchDrainTimer = 0;
    this.p2Ball.axeAngle = 0;
    this.p2Ball.axeHitCooldowns = {};
    this.p2Ball.daggerStock = 0;
    this.p2Ball.daggerSpawnTimer = 0;
    this.p2Ball.daggerThrowTimer = 0;
    this.p2Ball.trail = [];
    this.p2Ball.bounces = 0;
    this.p2Ball.damageDealt = 0;
    this.p2Ball.kills = 0;
    this.p2Ball.facingAngle = this.p2Ball.aimAngle;

    this.balls = [this.p1Ball, this.p2Ball];
    this.vfx.clear();

    if (keepAnglesLocked) {
      // Keep angles locked, countdown and launch immediately!
      this.p1Ball.isAiming = false;
      this.p1Ball.isReady = true;
      this.p2Ball.isAiming = false;
      this.p2Ball.isReady = true;
      this.sandboxPhase = 'COUNTDOWN';
      this.countdownTimer = 3.2;
      this.lastCountdownSec = 4;
      soundFX.playCountdownBeep(false);
    } else {
      // Unlock angles for editing
      this.p1Ball.isAiming = true;
      this.p1Ball.isReady = false;
      this.p2Ball.isAiming = true;
      this.p2Ball.isReady = false;
      this.sandboxPhase = 'AIMING';
      this.countdownTimer = 0;
      this.lastCountdownSec = -1;
      soundFX.playAimTick();
    }

    if (this.onUpdateUI) this.onUpdateUI();
  }

  private launchSandboxDuel() {
    if (!this.p1Ball || !this.p2Ball) return;

    this.sandboxPhase = 'BATTLE';
    this.p1Ball.isAiming = false;
    this.p2Ball.isAiming = false;

    // Reset cooldowns right before battle starts so skills charge up their full duration
    this.p1Ball.cooldownTimer = this.p1Ball.skill.cooldown;
    this.p2Ball.cooldownTimer = this.p2Ball.skill.cooldown;
    this.p1Ball.isSkillActive = false;
    this.p2Ball.isSkillActive = false;

    // Launch velocities
    const speed = 190;
    this.p1Ball.vx = Math.cos(this.p1Ball.aimAngle) * speed;
    this.p1Ball.vy = Math.sin(this.p1Ball.aimAngle) * speed;
    this.p1Ball.facingAngle = this.p1Ball.aimAngle;

    this.p2Ball.vx = Math.cos(this.p2Ball.aimAngle) * speed;
    this.p2Ball.vy = Math.sin(this.p2Ball.aimAngle) * speed;
    this.p2Ball.facingAngle = this.p2Ball.aimAngle;

    soundFX.playLaunchWhoosh();
    this.vfx.triggerScreenShake(14);
    this.vfx.emitShockwaveRing(this.p1Ball.x, this.p1Ball.y, this.p1Ball.skin.glowColor, 80, 0.45);
    this.vfx.emitShockwaveRing(this.p2Ball.x, this.p2Ball.y, this.p2Ball.skin.glowColor, 80, 0.45);

    if (this.onUpdateUI) this.onUpdateUI();
  }

  // ==========================================
  // ONLINE DUEL METHODS
  // ==========================================

  public initOnlineRound(
    p1Type: BallTypeId,
    p2Type: BallTypeId,
    p1Hp: number,
    p2Hp: number,
    myPlayerIdx: 1 | 2
  ) {
    this.gameMode = 'ONLINE_DUEL';
    this.onlineLocalPlayerIdx = myPlayerIdx;
    this.balls = [];
    this.daggers = [];
    this.thrownDaggers = [];
    this.hazardManager.clear();
    this.vfx.clear();
    this.winner = null;
    this.isDraw = false;
    this.matchEndHandled = false;
    this.countdownTimer = 0;
    this.lastCountdownSec = -1;

    const dist = this.box.size * 0.28;
    const y = this.box.centerY;

    // Ball 1 on left side
    const x1 = this.box.centerX - dist;
    this.p1Ball = new Ball(p1Type, x1, y, 0, 0);
    this.attachBallEvents(this.p1Ball);
    this.p1Ball.hp = Math.min(p1Hp, this.p1Ball.maxHp);
    this.p1Ball.aimAngle = -0.15;
    this.p1Ball.facingAngle = -0.15;
    this.p1Ball.isAiming = (myPlayerIdx === 1);
    this.p1Ball.isReady = false;

    // Ball 2 on right side
    const x2 = this.box.centerX + dist;
    this.p2Ball = new Ball(p2Type, x2, y, 0, 0);
    this.attachBallEvents(this.p2Ball);
    this.p2Ball.hp = Math.min(p2Hp, this.p2Ball.maxHp);
    this.p2Ball.aimAngle = Math.PI + 0.15;
    this.p2Ball.facingAngle = Math.PI + 0.15;
    this.p2Ball.isAiming = (myPlayerIdx === 2);
    this.p2Ball.isReady = false;

    this.balls = [this.p1Ball, this.p2Ball];
    if (this.onUpdateUI) this.onUpdateUI();
  }

  public setOnlineLocalAim(angleRad: number) {
    const ball = this.onlineLocalPlayerIdx === 1 ? this.p1Ball : this.p2Ball;
    if (ball) {
      ball.aimAngle = angleRad;
      ball.facingAngle = angleRad;
      if (this.onUpdateUI) this.onUpdateUI();
    }
  }

  public startOnlineCountdown(p1Angle: number, p2Angle: number) {
    if (this.p1Ball && this.p2Ball) {
      this.p1Ball.aimAngle = p1Angle;
      this.p1Ball.facingAngle = p1Angle;
      this.p1Ball.isAiming = true;
      this.p1Ball.isReady = true;

      this.p2Ball.aimAngle = p2Angle;
      this.p2Ball.facingAngle = p2Angle;
      this.p2Ball.isAiming = true;
      this.p2Ball.isReady = true;

      this.countdownTimer = 3.2;
      this.lastCountdownSec = 4;
      soundFX.playCountdownBeep(false);
      if (this.onUpdateUI) this.onUpdateUI();
    }
  }

  public launchOnlineBattle(p1Angle: number, p2Angle: number) {
    if (!this.p1Ball || !this.p2Ball) return;
    this.countdownTimer = 0;
    this.p1Ball.isAiming = false;
    this.p2Ball.isAiming = false;

    this.p1Ball.cooldownTimer = this.p1Ball.skill.cooldown;
    this.p2Ball.cooldownTimer = this.p2Ball.skill.cooldown;
    this.p1Ball.isSkillActive = false;
    this.p2Ball.isSkillActive = false;

    const speed = 190;
    this.p1Ball.vx = Math.cos(p1Angle) * speed;
    this.p1Ball.vy = Math.sin(p1Angle) * speed;
    this.p1Ball.facingAngle = p1Angle;

    this.p2Ball.vx = Math.cos(p2Angle) * speed;
    this.p2Ball.vy = Math.sin(p2Angle) * speed;
    this.p2Ball.facingAngle = p2Angle;

    soundFX.playLaunchWhoosh();
    this.vfx.triggerScreenShake(14);
    this.vfx.emitShockwaveRing(this.p1Ball.x, this.p1Ball.y, this.p1Ball.skin.glowColor, 80, 0.45);
    this.vfx.emitShockwaveRing(this.p2Ball.x, this.p2Ball.y, this.p2Ball.skin.glowColor, 80, 0.45);
    if (this.onUpdateUI) this.onUpdateUI();
  }

  // ==========================================
  // POINTER & TOUCH AIMING INTERACTION
  // ==========================================

  private initPointerEvents() {
    const getPos = (e: MouseEvent | Touch) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleStart = (pos: { x: number; y: number }) => {
      const isSandboxAim = this.gameMode === 'SANDBOX' && this.sandboxPhase === 'AIMING';
      const isOnlineAim = this.gameMode === 'ONLINE_DUEL' && this.countdownTimer <= 0 && (!this.p1Ball?.vx && !this.p2Ball?.vx);
      if (!isSandboxAim && !isOnlineAim) return;

      if (this.p1Ball && !this.p1Ball.isReady && (isSandboxAim || this.onlineLocalPlayerIdx === 1)) {
        const d1 = Math.hypot(pos.x - this.p1Ball.x, pos.y - this.p1Ball.y);
        if (d1 < this.p1Ball.radius + 35) {
          this.draggingBall = this.p1Ball;
          this.p1Ball.isSelectedForAim = true;
          return;
        }
      }

      if (this.p2Ball && !this.p2Ball.isReady && (isSandboxAim || this.onlineLocalPlayerIdx === 2)) {
        const d2 = Math.hypot(pos.x - this.p2Ball.x, pos.y - this.p2Ball.y);
        if (d2 < this.p2Ball.radius + 35) {
          this.draggingBall = this.p2Ball;
          this.p2Ball.isSelectedForAim = true;
          return;
        }
      }
    };

    const handleMove = (pos: { x: number; y: number }) => {
      const isSandboxAim = this.gameMode === 'SANDBOX' && this.sandboxPhase === 'AIMING';
      const isOnlineAim = this.gameMode === 'ONLINE_DUEL' && this.countdownTimer <= 0 && (!this.p1Ball?.vx && !this.p2Ball?.vx);
      if (!isSandboxAim && !isOnlineAim) return;

      if (this.draggingBall && !this.draggingBall.isReady) {
        const dx = pos.x - this.draggingBall.x;
        const dy = pos.y - this.draggingBall.y;
        this.draggingBall.aimAngle = Math.atan2(dy, dx);
        this.draggingBall.facingAngle = this.draggingBall.aimAngle;
        if (this.gameMode === 'ONLINE_DUEL' && this.onOnlineAimChanged) {
          this.onOnlineAimChanged(this.draggingBall.aimAngle);
        }
        if (this.onUpdateUI) this.onUpdateUI();
      } else {
        // Hover highlight
        const nearP1 = this.p1Ball && (isSandboxAim || this.onlineLocalPlayerIdx === 1) && Math.hypot(pos.x - this.p1Ball.x, pos.y - this.p1Ball.y) < this.p1Ball.radius + 30;
        const nearP2 = this.p2Ball && (isSandboxAim || this.onlineLocalPlayerIdx === 2) && Math.hypot(pos.x - this.p2Ball.x, pos.y - this.p2Ball.y) < this.p2Ball.radius + 30;

        if (this.p1Ball) this.p1Ball.isSelectedForAim = !!nearP1;
        if (this.p2Ball) this.p2Ball.isSelectedForAim = !!nearP2;
        this.canvas.style.cursor = nearP1 || nearP2 ? 'crosshair' : 'default';
      }
    };

    const handleEnd = () => {
      if (this.draggingBall) {
        this.draggingBall.isSelectedForAim = false;
        this.draggingBall = null;
      }
    };

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => handleStart(getPos(e)));
    window.addEventListener('mousemove', (e) => handleMove(getPos(e)));
    window.addEventListener('mouseup', () => handleEnd());

    // Touch events for mobile/tablet
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 0) handleStart(getPos(e.touches[0]));
      },
      { passive: true }
    );
    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length > 0) handleMove(getPos(e.touches[0]));
      },
      { passive: true }
    );
    window.addEventListener('touchend', () => handleEnd());
  }

  // ==========================================
  // MAIN GAME LOOP
  // ==========================================

  private loop(timestamp: number) {
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    const dt = Math.min(rawDt, 0.05) * this.timeScale;

    if (!this.isPaused && dt > 0) {
      this.update(dt);
    }

    this.render();
  }

  private update(dt: number) {
    const isSandbox = this.gameMode === 'SANDBOX';
    const isOnline = this.gameMode === 'ONLINE_DUEL';

    // Once a result is declared, freeze gameplay state while allowing existing VFX to finish.
    if (this.winner || this.isDraw) {
      this.vfx.update(dt);
      if (this.onUpdateUI) this.onUpdateUI();
      return;
    }

    if (isOnline) {
      if (this.countdownTimer > 0) {
        this.countdownTimer -= dt;
        const currentSec = Math.ceil(this.countdownTimer);
        if (currentSec !== this.lastCountdownSec) {
          this.lastCountdownSec = currentSec;
          if (currentSec > 0) {
            soundFX.playCountdownBeep(false);
            this.vfx.triggerScreenShake(3);
          } else {
            soundFX.playCountdownBeep(true);
          }
        }

        if (this.countdownTimer <= 0) {
          this.countdownTimer = 0;
          // Auto-launch battle locally if timer finishes
          if (this.p1Ball && this.p2Ball && this.p1Ball.vx === 0 && this.p2Ball.vx === 0) {
            this.launchOnlineBattle(this.p1Ball.aimAngle, this.p2Ball.aimAngle);
          }
        }

        if (this.onUpdateUI) this.onUpdateUI();
        return;
      }

      // If balls haven't been launched yet (vx === 0 and vy === 0), freeze in aiming
      if (this.p1Ball && this.p2Ball && this.p1Ball.vx === 0 && this.p1Ball.vy === 0 && this.p2Ball.vx === 0 && this.p2Ball.vy === 0) {
        this.vfx.update(dt);
        if (this.onUpdateUI) this.onUpdateUI();
        return;
      }

      // If Guest during battle, Host sends authoritative snapshots; Guest runs local motion prediction
      if (this.onlineLocalPlayerIdx === 2) {
        const subDt = dt / this.subSteps;
        for (let step = 0; step < this.subSteps; step++) {
          this.box.update(subDt);
          for (const b of this.balls) {
            b.x += b.vx * subDt;
            b.y += b.vy * subDt;
            if (Math.hypot(b.vx, b.vy) > 0.01) {
              b.facingAngle = Math.atan2(b.vy, b.vx);
            }
            b.spinAngle += (b.vx + b.vy) * 0.01;
            this.box.resolveBallCollision(b);
            b.skillStrategy.updateTick?.(b, subDt, this.balls, this.vfx, true);
          }
          this.hazardManager.update(subDt, this.balls, this.vfx);
        }
        for (const b of this.balls) {
          b.trail.unshift({ x: b.x, y: b.y });
          if (b.trail.length > 12) b.trail.pop();
        }
        this.vfx.update(dt);
        if (this.onUpdateUI) this.onUpdateUI();
        return;
      }
    }

    // Handle Sandbox Countdown
    if (isSandbox && this.sandboxPhase === 'COUNTDOWN') {
      this.countdownTimer -= dt;
      const currentSec = Math.ceil(this.countdownTimer);

      if (currentSec !== this.lastCountdownSec) {
        this.lastCountdownSec = currentSec;
        if (currentSec > 0) {
          soundFX.playCountdownBeep(false);
          this.vfx.triggerScreenShake(3);
        } else {
          soundFX.playCountdownBeep(true);
        }
      }

      if (this.countdownTimer <= 0) {
        this.launchSandboxDuel();
      }
      if (this.onUpdateUI) {
        this.onUpdateUI();
      }
      return;
    }

    // In Sandbox Setup / Aiming phase, physics don't move balls
    if (isSandbox && (this.sandboxPhase === 'SELECTING_BALLS' || this.sandboxPhase === 'AIMING')) {
      this.vfx.update(dt);
      if (this.onUpdateUI) {
        this.onUpdateUI();
      }
      return;
    }

    const subDt = dt / this.subSteps;

    for (let step = 0; step < this.subSteps; step++) {
      // 1. Update Box Rotation
      this.box.update(subDt);

      // 2. Update Balls (Motion, Skills, Timers)
      for (const b of this.balls) {
        b.update(subDt, this.balls, this.vfx, true); // HP tracking active in both modes for duel thrills
      }

      this.updateDaggers(subDt);
      this.processVoidSingularities();

      // 2.5. Update Vampire Latch Pinning (Di chuyển dính chặt khi đang cắn nanh)
      this.updateVampireLatches(subDt);

      // 3. Wall Collisions
      for (const b of this.balls) {
        if (b.isDead) continue;
        const res = this.box.resolveBallCollision(b);
        if (res.hit) {
          b.bounces++;
          b.skillStrategy.onWallHit?.(b, res.contactPoint, this.vfx);
          // If this ball is latched by a vampire, update vampire's velocity and facing angle so they turn together off the wall!
          if (b.latchedByVampireId) {
            const vamp = this.balls.find((v) => v.id === b.latchedByVampireId && !v.isDead);
            if (vamp) {
              vamp.vx = b.vx;
              vamp.vy = b.vy;
              vamp.facingAngle = Math.atan2(vamp.vy, vamp.vx);
            }
          } else if (b.latchedTargetId) {
            b.facingAngle = Math.atan2(b.vy, b.vx);
          }

          // Volt speed scaling: +10% per wall bounce, capped at 2.2x baseTargetSpeed
          if (b.typeId === 'VOLT') {
            const maxSpeed = b.baseTargetSpeed * 2.2;
            b.targetSpeed = Math.min(maxSpeed, b.targetSpeed * 1.10);
            const curSpeed = Math.hypot(b.vx, b.vy);
            if (curSpeed > 0.001) {
              const newSpeed = Math.min(maxSpeed, curSpeed * 1.10);
              b.vx = (b.vx / curSpeed) * newSpeed;
              b.vy = (b.vy / curSpeed) * newSpeed;
            }
            this.vfx.emitSparks(res.contactPoint.x, res.contactPoint.y, '#fde047', 8, 190);
          }
          soundFX.playWallBounce(res.impactSpeed / 240);
          this.vfx.emitSparks(res.contactPoint.x, res.contactPoint.y, b.skin.glowColor, 4, 120);
        }
      }

      // 4. Ball-to-Ball Collisions
      for (let i = 0; i < this.balls.length; i++) {
        for (let j = i + 1; j < this.balls.length; j++) {
          const b1 = this.balls[i];
          const b2 = this.balls[j];
          if (b1.isDead || b2.isDead) continue;

          // Orbiting axe deals separate contact damage without requiring the balls themselves to collide.
          // Note: This must run even when latched so an Axe victim can still strike the latched Vampire!
          for (const [attacker, target] of [[b1, b2], [b2, b1]] as const) {
            if (attacker.typeId !== 'AXE') continue;
            let isAxeTouching = false;
            let closestBladeX = attacker.x;
            let closestBladeY = attacker.y;
            // Test several points along this sub-step's rotation so fast spinning
            // cannot skip over a target between physics samples.
            for (let sample = 0; sample <= 4; sample++) {
              const progress = sample / 4;
              const angle = attacker.axePreviousAngle
                + (attacker.axeAngle - attacker.axePreviousAngle) * progress;
              const orbitRadius = attacker.radius + 25;
              const orbitX = attacker.x + Math.cos(angle) * orbitRadius;
              const orbitY = attacker.y + Math.sin(angle) * orbitRadius;
              // Check distance to the visible blade edge, not just its orbit center.
              const bladeAngle = angle + Math.PI / 2;
              const bladeStartX = orbitX + Math.cos(bladeAngle) * 5 + Math.sin(bladeAngle) * 25;
              const bladeStartY = orbitY + Math.sin(bladeAngle) * 5 - Math.cos(bladeAngle) * 25;
              const bladeEndX = orbitX + Math.cos(bladeAngle) * 27 + Math.sin(bladeAngle) * 7;
              const bladeEndY = orbitY + Math.sin(bladeAngle) * 27 - Math.cos(bladeAngle) * 7;
              const bladeX = bladeEndX - bladeStartX;
              const bladeY = bladeEndY - bladeStartY;
              const bladeLengthSq = bladeX * bladeX + bladeY * bladeY;
              const projection = bladeLengthSq > 0
                ? Math.max(0, Math.min(1, ((target.x - bladeStartX) * bladeX + (target.y - bladeStartY) * bladeY) / bladeLengthSq))
                : 0;
              const pointX = bladeStartX + projection * bladeX;
              const pointY = bladeStartY + projection * bladeY;
              if (Math.hypot(pointX - target.x, pointY - target.y) <= target.radius + 8) {
                isAxeTouching = true;
                closestBladeX = pointX;
                closestBladeY = pointY;
                break;
              }
            }
            if (isAxeTouching && !attacker.isFrozen() && !attacker.axeHitCooldowns[target.id]) {
              target.takeDamage(attacker.getAxeDamage(), attacker, this.vfx);
              attacker.axeHitCooldowns[target.id] = true;
              this.vfx.emitSparks(closestBladeX, closestBladeY, '#fbbf24', 9, 150);
              this.vfx.addFloatingText(target.x, target.y - target.radius, '🪓 TRÚNG RÌU!', '#fbbf24', 15);
            } else if (!isAxeTouching) {
              // Re-arm damage once the axe has separated; the next contact deals damage immediately.
              delete attacker.axeHitCooldowns[target.id];
            }
          }

          // If either ball died from axe damage, skip body collision
          if (b1.isDead || b2.isDead) continue;

          // If already latched together, skip elastic bounce and fangs collision resolution
          if (b1.latchedTargetId === b2.id || b2.latchedTargetId === b1.id) continue;

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const distSq = dx * dx + dy * dy;
          const minDist = b1.radius + b2.radius;
          if (distSq >= minDist * minDist) continue;

          const isAllied = b1.id === b2.ownerId || b2.id === b1.ownerId || (b1.ownerId !== null && b1.ownerId === b2.ownerId);

          // Clown marks apply on every opposing body collision, including vampire latch collisions.
          if (!isAllied && b1.typeId === 'CLOWN' && b2.clownMarks < 5) {
            b2.clownMarks++;
            b2.clownMarkTimer = 5.0;
            this.vfx.emitSparks(b2.x, b2.y - b2.radius, '#f472b6', 5, 100);
          }
          if (!isAllied && b2.typeId === 'CLOWN' && b1.clownMarks < 5) {
            b1.clownMarks++;
            b1.clownMarkTimer = 5.0;
            this.vfx.emitSparks(b1.x, b1.y - b1.radius, '#f472b6', 5, 100);
          }

          // Only contact with an opposing ball resets SonGoku's rage.
          if (!isAllied && b1.typeId === 'GOKU') {
            b1.gokuRage = 0;
            b1.gokuCollisionCooldown = 0.1;
          }
          if (!isAllied && b2.typeId === 'GOKU') {
            b2.gokuRage = 0;
            b2.gokuCollisionCooldown = 0.1;
          }

          const contactX = (b1.x * b2.radius + b2.x * b1.radius) / minDist;
          const contactY = (b1.y * b2.radius + b2.y * b1.radius) / minDist;

          // Check Fang Strike for B1 (if Vampire strikes B2 with front fangs)
          let isFangStrike1 = false;
          if (b1.typeId === 'VAMPIRE' && !b1.isFrozen()) {
            const angleB1ToB2 = Math.atan2(dy, dx);
            let diff1 = Math.abs(angleB1ToB2 - b1.facingAngle);
            while (diff1 > Math.PI) diff1 = Math.abs(diff1 - 2 * Math.PI);
            if (diff1 <= Math.PI / 4) { // Narrow front arc (±45 deg)
              isFangStrike1 = true;
            }
          }

          // Check Fang Strike for B2 (if Vampire strikes B1 with front fangs)
          let isFangStrike2 = false;
          if (b2.typeId === 'VAMPIRE' && !b2.isFrozen()) {
            const angleB2ToB1 = Math.atan2(-dy, -dx);
            let diff2 = Math.abs(angleB2ToB1 - b2.facingAngle);
            while (diff2 > Math.PI) diff2 = Math.abs(diff2 - 2 * Math.PI);
            if (diff2 <= Math.PI / 4) { // Narrow front arc (±45 deg)
              isFangStrike2 = true;
            }
          }

          // Can B1 latch B2?
          const canB1Latch = isFangStrike1 && b1.latchedTargetId === null && b1.latchCooldown <= 0 && !isAllied;
          // Can B2 latch B1?
          const canB2Latch = isFangStrike2 && b2.latchedTargetId === null && b2.latchCooldown <= 0 && !isAllied;

          if (canB1Latch) {
            // B1 latches onto B2 (Đâm dính vào và ngậm hút máu liên tục)
            b1.latchedTargetId = b2.id;
            b1.latchTimer = 1.0;
            b1.latchDrainTimer = 0;
            b2.latchedByVampireId = b1.id;

            const dmg = b1.getFangDamage();
            const hpBefore = b2.hp;
            b2.takeDamage(dmg, b1, this.vfx);
            const actualDmg = hpBefore - b2.hp;
            if (actualDmg > 0) {
              const lifestealRate = b1.isSkillActive ? 0.7 : 0.5;
              b1.heal(actualDmg * lifestealRate, this.vfx, b1.isSkillActive);
            }

            soundFX.playVampireBite();
            this.vfx.addFloatingText(b1.x, b1.y - 28, '🩸 ĐÂM DÍNH HÚT MÁU!', '#f43f5e', 18);
            this.vfx.emitSparks(contactX, contactY, '#dc2626', 18, 220);

            if (b1.isSkillActive) {
              b2.applyStatusEffect('BLEEDING', 3.0);
              this.vfx.addFloatingText(b2.x, b2.y, '🩸 CHẢY MÁU 3s!', '#dc2626', 16);
            }

            // Carry victim along Vampire's heading (no elastic bounce!)
            const driveSpeed = Math.max(b1.targetSpeed, Math.hypot(b1.vx, b1.vy));
            b1.vx = Math.cos(b1.facingAngle) * driveSpeed;
            b1.vy = Math.sin(b1.facingAngle) * driveSpeed;
            b2.vx = b1.vx;
            b2.vy = b1.vy;
            const lockDist = b1.radius + b2.radius - 2;
            b2.x = b1.x + Math.cos(b1.facingAngle) * lockDist;
            b2.y = b1.y + Math.sin(b1.facingAngle) * lockDist;

            // Retaliation from victim if not frozen
            if (!b2.isFrozen()) {
              const retDmg = isFangStrike2 ? b2.getFangDamage() : b2.getCollisionDamage();
              if (retDmg > 0) {
                b1.takeDamage(retDmg, b2, this.vfx);
              }
            }
          } else if (canB2Latch) {
            // B2 latches onto B1 (Đâm dính vào và ngậm hút máu liên tục)
            b2.latchedTargetId = b1.id;
            b2.latchTimer = 1.0;
            b2.latchDrainTimer = 0;
            b1.latchedByVampireId = b2.id;

            const dmg = b2.getFangDamage();
            const hpBefore = b1.hp;
            b1.takeDamage(dmg, b2, this.vfx);
            const actualDmg = hpBefore - b1.hp;
            if (actualDmg > 0) {
              const lifestealRate = b2.isSkillActive ? 0.7 : 0.5;
              b2.heal(actualDmg * lifestealRate, this.vfx, b2.isSkillActive);
            }

            soundFX.playVampireBite();
            this.vfx.addFloatingText(b2.x, b2.y - 28, '🩸 ĐÂM DÍNH HÚT MÁU!', '#f43f5e', 18);
            this.vfx.emitSparks(contactX, contactY, '#dc2626', 18, 220);

            if (b2.isSkillActive) {
              b1.applyStatusEffect('BLEEDING', 3.0);
              this.vfx.addFloatingText(b1.x, b1.y, '🩸 CHẢY MÁU 3s!', '#dc2626', 16);
            }

            // Carry victim along Vampire's heading (no elastic bounce!)
            const driveSpeed = Math.max(b2.targetSpeed, Math.hypot(b2.vx, b2.vy));
            b2.vx = Math.cos(b2.facingAngle) * driveSpeed;
            b2.vy = Math.sin(b2.facingAngle) * driveSpeed;
            b1.vx = b2.vx;
            b1.vy = b2.vy;
            const lockDist = b2.radius + b1.radius - 2;
            b1.x = b2.x + Math.cos(b2.facingAngle) * lockDist;
            b1.y = b2.y + Math.sin(b2.facingAngle) * lockDist;

            // Retaliation from victim if not frozen
            if (!b1.isFrozen()) {
              const retDmg = isFangStrike1 ? b1.getFangDamage() : b1.getCollisionDamage();
              if (retDmg > 0) {
                b2.takeDamage(retDmg, b1, this.vfx);
              }
            }
          } else {
            // Normal collision - Elastic Bounce
            const col = CollisionResolver.resolveBalls(b1, b2);
            if (col) {
              soundFX.playBallCollide(col.relativeSpeed / 200);
              this.vfx.emitSparks(col.contactX, col.contactY, '#ffffff', 5, 160);

              if (!b1.isFrozen() && b1.isSkillActive && b1.typeId === 'BLAZE') {
                this.vfx.triggerScreenShake(8);
                soundFX.playBlazeDash();
                this.vfx.emitShockwaveRing(col.contactX, col.contactY, '#ff4500', 70, 0.4);
                this.vfx.emitSparks(col.contactX, col.contactY, '#ff4500', 16, 220);
              }
              if (!b2.isFrozen() && b2.isSkillActive && b2.typeId === 'BLAZE') {
                this.vfx.triggerScreenShake(8);
                soundFX.playBlazeDash();
                this.vfx.emitShockwaveRing(col.contactX, col.contactY, '#ff4500', 70, 0.4);
                this.vfx.emitSparks(col.contactX, col.contactY, '#ff4500', 16, 220);
              }

              if (b1.isFrozen() || b2.isFrozen()) {
                this.vfx.emitSparks(col.contactX, col.contactY, '#bae6fd', 8, 180);
              }

              let dmgOnB2 = isFangStrike1 ? b1.getFangDamage() : b1.getCollisionDamage();
              let dmgOnB1 = isFangStrike2 ? b2.getFangDamage() : b2.getCollisionDamage();
              if (b1.isFrozen()) dmgOnB2 = 0;
              if (b2.isFrozen()) dmgOnB1 = 0;
              if (isAllied) {
                dmgOnB1 = 0;
                dmgOnB2 = 0;
              }

              if (dmgOnB1 > 0) {
                const hpBefore = b1.hp;
                b1.takeDamage(dmgOnB1, b2, this.vfx);
                const actualDmg = hpBefore - b1.hp;
                if (isFangStrike2 && actualDmg > 0) {
                  const lifestealRate = b2.isSkillActive ? 0.7 : 0.5;
                  b2.heal(actualDmg * lifestealRate, this.vfx, b2.isSkillActive);
                  soundFX.playVampireBite();
                  this.vfx.addFloatingText(b2.x, b2.y - 12, `🩸 CẮN HÚT (+${actualDmg})!`, '#f43f5e', 16);
                  this.vfx.emitSparks(col.contactX, col.contactY, '#dc2626', 15, 200);
                  if (b2.isSkillActive) {
                    b1.applyStatusEffect('BLEEDING', 3.0);
                    this.vfx.addFloatingText(b1.x, b1.y, '🩸 CHẢY MÁU 3s!', '#dc2626', 16);
                  }
                }
              }

              if (dmgOnB2 > 0) {
                const hpBefore = b2.hp;
                b2.takeDamage(dmgOnB2, b1, this.vfx);
                const actualDmg = hpBefore - b2.hp;
                if (isFangStrike1 && actualDmg > 0) {
                  const lifestealRate = b1.isSkillActive ? 0.7 : 0.5;
                  b1.heal(actualDmg * lifestealRate, this.vfx, b1.isSkillActive);
                  soundFX.playVampireBite();
                  this.vfx.addFloatingText(b1.x, b1.y - 12, `🩸 CẮN HÚT (+${actualDmg})!`, '#f43f5e', 16);
                  this.vfx.emitSparks(col.contactX, col.contactY, '#dc2626', 15, 200);
                  if (b1.isSkillActive) {
                    b2.applyStatusEffect('BLEEDING', 3.0);
                    this.vfx.addFloatingText(b2.x, b2.y, '🩸 CHẢY MÁU 3s!', '#dc2626', 16);
                  }
                }
              }
            }
          }
        }
      }
    }

    // 5. Environmental Hazards (Frost, Toxic, Meteor, Lightning)
    this.hazardManager.update(dt, this.balls, this.vfx);

    // 6. Update VFX & Particles
    this.vfx.update(dt);

    // Split before checking for a winner so a Slime's children remain in the fight.
    this.processSlimeSplits();

    // 6.5. Filter out expired/dead minions to keep simulation clean
    this.balls = this.balls.filter((b) => !b.isMinion || !b.isDead);

    // 7. Win condition check
    if (!this.winner && !this.isDraw && this.balls.length > 1) {
      const aliveBalls = this.balls.filter((b) => !b.isDead && !b.isMinion);
      if (aliveBalls.length === 1) {
        this.winner = aliveBalls[0];
        this.isDraw = false;
        soundFX.playVictory();
        this.vfx.triggerScreenShake(12);
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            if (this.winner) {
              this.vfx.emitShockwaveRing(this.winner.x, this.winner.y, this.winner.skin.glowColor, 180, 0.8);
              this.vfx.emitSparks(this.winner.x, this.winner.y, '#fef08a', 30, 260);
            }
          }, i * 200);
        }
      } else if (aliveBalls.length === 0) {
        this.isDraw = true;
        this.winner = null;
        soundFX.playDeath();
        this.vfx.triggerScreenShake(14);
      }
    }

    if ((this.winner || this.isDraw) && !this.matchEndHandled) {
      this.finishMatch();
    }

    if (this.onUpdateUI) {
      this.onUpdateUI();
    }
  }

  private processVoidSingularities(): void {
    for (const b of this.balls) {
      if (b.isDead || !b.isSkillActive || b.typeId !== 'VOID') continue;
      const holeX = b.voidBlackHoleX;
      const holeY = b.voidBlackHoleY;
      const radius = VOID_SKILL_RADIUS;

      // 1. Disintegrate hazards in HazardManager (Frost, Toxic, Lightning, Meteor)
      const hazCount = this.hazardManager.disintegrateInArea(holeX, holeY, radius, this.vfx);
      if (hazCount > 0) {
        soundFX.playVoidDisintegrate();
      }

      // 2. Disintegrate ground daggers
      let daggerRemoved = false;
      for (let i = this.daggers.length - 1; i >= 0; i--) {
        const d = this.daggers[i];
        if (Math.hypot(d.x - holeX, d.y - holeY) <= radius + 12) {
          this.vfx.emitSparks(d.x, d.y, '#a855f7', 8, 90);
          this.vfx.emitShockwaveRing(d.x, d.y, '#c084fc', 20, 0.2);
          this.daggers.splice(i, 1);
          daggerRemoved = true;
        }
      }

      // 3. Disintegrate thrown daggers
      for (let i = this.thrownDaggers.length - 1; i >= 0; i--) {
        const td = this.thrownDaggers[i];
        if (Math.hypot(td.x - holeX, td.y - holeY) <= radius + 10) {
          this.vfx.emitSparks(td.x, td.y, '#a855f7', 8, 100);
          this.vfx.emitShockwaveRing(td.x, td.y, '#c084fc', 22, 0.2);
          this.thrownDaggers.splice(i, 1);
          daggerRemoved = true;
        }
      }
      if (daggerRemoved) {
        soundFX.playVoidDisintegrate();
      }

      // 4. Disintegrate hero entities from skills (Wood seeds, Spider webs)
      for (const other of this.balls) {
        other.skillStrategy.clearEntitiesInArea?.(holeX, holeY, radius, this.vfx);
      }
    }
  }

  private updateDaggers(dt: number): void {
    const arenaHalf = Math.max(0, this.box.size * 0.5 - 24);
    const attackRange = 220;
    for (const ball of this.balls) {
      if (ball.isDead || ball.typeId !== 'DAGGER') continue;
      ball.daggerSpawnTimer += dt;
      while (ball.daggerSpawnTimer >= 1.5) {
        ball.daggerSpawnTimer -= 1.5;
        const angle = this.box.angle;
        const localX = (Math.random() * 2 - 1) * arenaHalf;
        const localY = (Math.random() * 2 - 1) * arenaHalf;
        this.daggers.push({
          x: this.box.centerX + localX * Math.cos(angle) - localY * Math.sin(angle),
          y: this.box.centerY + localX * Math.sin(angle) + localY * Math.cos(angle),
        });
      }
      if (ball.daggerStock > 0) {
        const target = this.balls
          .filter((other) => {
            const isAllied = other.id === ball.ownerId || ball.id === other.ownerId || (ball.ownerId !== null && ball.ownerId === other.ownerId);
            return !other.isDead && other.id !== ball.id && !isAllied;
          })
          .map((other) => ({ ball: other, distance: Math.hypot(other.x - ball.x, other.y - ball.y) }))
          .filter(({ distance }) => distance <= attackRange)
          .sort((a, b) => a.distance - b.distance)[0]?.ball;

        if (target) {
          const baseAngle = Math.atan2(target.y - ball.y, target.x - ball.x);
          const daggerCount = ball.daggerStock;
          ball.daggerStock = 0;
          for (let index = 0; index < daggerCount; index++) {
            const spread = (index - (daggerCount - 1) / 2) * 0.035;
            const angle = baseAngle + spread;
            this.thrownDaggers.push({
              x: ball.x + Math.cos(angle) * (ball.radius + 10),
              y: ball.y + Math.sin(angle) * (ball.radius + 10),
              vx: Math.cos(angle) * 420,
              vy: Math.sin(angle) * 420,
              ownerId: ball.id,
              life: 2.5,
            });
          }
        }
      }
    }

    for (let i = this.daggers.length - 1; i >= 0; i--) {
      const dagger = this.daggers[i];
      const collector = this.balls.find((ball) => !ball.isDead && Math.hypot(ball.x - dagger.x, ball.y - dagger.y) <= ball.radius + 9);
      if (collector) {
        if (collector.typeId === 'DAGGER') {
          collector.daggerStock++;
          this.vfx.addFloatingText(collector.x, collector.y - collector.radius, '🗡️ +1 DAO', '#e2e8f0', 14);
        }
        this.daggers.splice(i, 1);
      }
    }

    for (let i = this.thrownDaggers.length - 1; i >= 0; i--) {
      const dagger = this.thrownDaggers[i];
      dagger.x += dagger.vx * dt;
      dagger.y += dagger.vy * dt;
      dagger.life -= dt;
      const owner = this.balls.find((ball) => ball.id === dagger.ownerId) ?? null;
      const target = this.balls.find((ball) => {
        const isAllied = owner && (ball.id === owner.ownerId || owner.id === ball.ownerId || (owner.ownerId !== null && owner.ownerId === ball.ownerId));
        return !ball.isDead && ball.id !== dagger.ownerId && !isAllied && Math.hypot(ball.x - dagger.x, ball.y - dagger.y) <= ball.radius + 7;
      });
      if (target) {
        target.takeDamage(12, owner, this.vfx);
        this.vfx.emitSparks(dagger.x, dagger.y, '#cbd5e1', 8, 110);
        this.thrownDaggers.splice(i, 1);
      } else if (dagger.life <= 0 || Math.hypot(dagger.x - this.box.centerX, dagger.y - this.box.centerY) > this.box.size) {
        this.thrownDaggers.splice(i, 1);
      }
    }
  }

  private finishMatch(): void {
    this.matchEndHandled = true;
    this.hazardManager.clear();
    for (const ball of this.balls) {
      ball.skillStrategy.onBattleEnd?.(ball, this.balls, this.vfx);
      ball.isSkillActive = false;
      ball.skillActiveTimer = 0;
    }
  }

  private render() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.save();

    // 1. Screen Shake
    const shake = this.vfx.getScreenShakeOffset();
    this.ctx.translate(shake.x, shake.y);

    // 2. Clear Screen
    this.ctx.fillStyle = '#070913';
    this.ctx.fillRect(-20, -20, width + 40, height + 40);

    // 3. Render Arena Box
    this.box.render(this.ctx);

    // 3.5. Render Floor Hazards (Frost Zones, Toxic Acid Pools & Lightning Trails)
    this.hazardManager.render(this.ctx, this.balls);
    this.renderDaggers();
    this.renderVampireLatchTether();

    // 4. Render Balls
    for (const b of this.balls) {
      b.render(this.ctx, true);
    }

    // 5. Render VFX & Damage Texts
    this.vfx.render(this.ctx);

    // 6. Countdown Overlay (In Sandbox or Online Duel Countdown Phase)
    if (this.gameMode === 'SANDBOX' && this.sandboxPhase === 'COUNTDOWN') {
      this.renderCountdown();
    } else if (this.gameMode === 'ONLINE_DUEL' && this.countdownTimer > 0) {
      this.renderCountdown();
    }

    // 7. Winner celebration banner inside canvas
    if (this.winner) {
      this.ctx.save();
      this.ctx.font = 'bold 28px system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = this.winner.skin.glowColor;
      this.ctx.shadowColor = this.winner.skin.glowColor;
      this.ctx.shadowBlur = 15;
      this.ctx.fillText(
        `🏆 ${this.winner.skin.vietnameseName} CHIẾN THẮNG! 🏆`,
        this.box.centerX,
        this.box.centerY - this.box.size / 2 - 25
      );
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private renderDaggers(): void {
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '18px sans-serif';
    this.ctx.shadowColor = '#cbd5e1';
    this.ctx.shadowBlur = 10;
    for (const dagger of this.daggers) this.ctx.fillText('🗡️', dagger.x, dagger.y);
    for (const dagger of this.thrownDaggers) {
      this.ctx.save();
      this.ctx.translate(dagger.x, dagger.y);
      this.ctx.rotate(Math.atan2(dagger.vy, dagger.vx));
      this.ctx.fillText('🗡️', 0, 0);
      this.ctx.restore();
    }
    this.ctx.restore();
  }

  private renderCountdown() {
    this.ctx.save();
    const sec = Math.ceil(this.countdownTimer);
    const text = sec > 0 ? `${sec}` : 'CHIẾN ĐẤU!';

    this.ctx.font = sec > 0 ? '900 84px Outfit, sans-serif' : '900 52px Outfit, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const pulse = 1 + (this.countdownTimer % 1) * 0.25;
    this.ctx.translate(this.box.centerX, this.box.centerY);
    this.ctx.scale(pulse, pulse);

    this.ctx.fillStyle = sec > 0 ? '#fde047' : '#22c55e';
    this.ctx.shadowColor = sec > 0 ? '#facc15' : '#4ade80';
    this.ctx.shadowBlur = 30;

    this.ctx.fillText(text, 0, 0);
    this.ctx.restore();
  }

  private updateVampireLatches(dt: number) {
    for (const b of this.balls) {
      if (b.typeId !== 'VAMPIRE' || !b.latchedTargetId) continue;

      const victim = this.balls.find((o) => o.id === b.latchedTargetId);
      if (b.isDead || !victim || victim.isDead) {
        // Target or vampire died -> release immediately so neither is stuck
        b.latchedTargetId = null;
        if (victim) victim.latchedByVampireId = null;
        b.latchTimer = 0;
        b.latchCooldown = 1.0;
        continue;
      }

      b.latchTimer -= dt;
      if (b.latchTimer <= 0) {
        // Latch duration ended -> release and push apart
        b.latchedTargetId = null;
        victim.latchedByVampireId = null;
        b.latchCooldown = 2.0;

        const sepSpeed = 190;
        const sepAngle = b.facingAngle;
        b.vx = -Math.cos(sepAngle) * (sepSpeed * 0.4);
        b.vy = -Math.sin(sepAngle) * (sepSpeed * 0.4);
        victim.vx = Math.cos(sepAngle) * sepSpeed;
        victim.vy = Math.sin(sepAngle) * sepSpeed;

        this.vfx.addFloatingText(b.x, b.y, '💨 NHẢ RA!', '#94a3b8', 14);
        soundFX.playWallBounce(1.0);
        continue;
      }

      // Keep victim pinned firmly directly in front of vampire's fangs
      const forwardAngle = b.facingAngle;
      const lockDist = b.radius + victim.radius - 2;
      victim.x = b.x + Math.cos(forwardAngle) * lockDist;
      victim.y = b.y + Math.sin(forwardAngle) * lockDist;
      victim.vx = b.vx;
      victim.vy = b.vy;

      // Continuous drain every 0.25s
      b.latchDrainTimer += dt;
      if (b.latchDrainTimer >= 0.25) {
        b.latchDrainTimer -= 0.25;
        const isEnraged = b.isSkillActive; // Có nộ hay không
        const drainPerTick = isEnraged ? 6 : 4;

        const hpBefore = victim.hp;
        victim.takeDamage(drainPerTick, b, this.vfx, true);
        const actualDmg = hpBefore - victim.hp;

        if (actualDmg > 0) {
          // Khi có nộ thì cho phép hút vượt quá lượng máu gốc (Overheal)
          const lifestealRate = isEnraged ? 0.7 : 0.5;
          b.heal(actualDmg * lifestealRate, this.vfx, isEnraged);
          soundFX.playVampireBite();
          this.vfx.emitSparks(victim.x, victim.y, '#dc2626', 8, 140);
        }

        if (victim.isDead) {
          b.latchedTargetId = null;
          victim.latchedByVampireId = null;
          b.latchCooldown = 1.0;
          continue;
        }
      }

      // Ambient blood stream VFX
      if (Math.random() < 0.4) {
        this.vfx.emitTrail(victim.x, victim.y, '#e11d48', victim.radius * 0.4);
      }
    }
  }

  private renderVampireLatchTether() {
    for (const b of this.balls) {
      if (b.typeId !== 'VAMPIRE' || !b.latchedTargetId || b.isDead) continue;
      const victim = this.balls.find((o) => o.id === b.latchedTargetId && !o.isDead);
      if (!victim) continue;

      this.ctx.save();
      // Glowing blood tendril
      this.ctx.strokeStyle = '#f43f5e';
      this.ctx.lineWidth = 3.5;
      this.ctx.shadowColor = '#dc2626';
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.moveTo(b.x, b.y);
      // Small jittery arc for electric/blood siphon effect
      const midX = (b.x + victim.x) / 2 + (Math.random() - 0.5) * 6;
      const midY = (b.y + victim.y) / 2 + (Math.random() - 0.5) * 6;
      this.ctx.lineTo(midX, midY);
      this.ctx.lineTo(victim.x, victim.y);
      this.ctx.stroke();

      // Blood droplet orbs flowing from victim to vampire
      const t = (Date.now() * 0.005) % 1;
      const orbX = victim.x + (b.x - victim.x) * t;
      const orbY = victim.y + (b.y - victim.y) * t;
      this.ctx.fillStyle = '#ffe4e6';
      this.ctx.beginPath();
      this.ctx.arc(orbX, orbY, 3.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }
  }
}
