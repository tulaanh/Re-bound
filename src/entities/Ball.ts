import { BALL_CONFIGS } from './BallTypes';
import type { BallTypeId, BallSkinConfig, BallSkillConfig, StatusEffect } from '../types';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';
import { createSkillStrategy, type SkillStrategy } from '../skills';

export class Ball {
  public static readonly MAX_SLIME_SPLITS = 3;

  public id: string;
  public typeId: BallTypeId;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public radius: number;
  public mass: number;

  public maxHp: number;
  public hp: number;
  public baseAttack: number;
  public isDead: boolean = false;

  public kills: number = 0;
  public bounces: number = 0;
  public damageDealt: number = 0;

  public skin: BallSkinConfig;
  public skill: BallSkillConfig;
  public skillStrategy: SkillStrategy;

  public cooldownTimer: number = 0;
  public isSkillActive: boolean = false;
  public skillActiveTimer: number = 0;
  public gokuRage: number = 0;
  public gokuSkillDamage: number = 8;
  public gokuCollisionCooldown: number = 0;
  public gokuBeamAngle: number = 0;
  public clownMarks: number = 0;
  public clownMarkTimer: number = 0;

  public statusEffects: StatusEffect[] = [];
  public trail: { x: number; y: number }[] = [];
  private maxTrailLength: number = 10;
  private trailTimer: number = 0;

  public spinAngle: number = 0;
  public targetSpeed: number = 160; // Standard cruising speed (reduced for clearer combat)

  // Sandbox Aim & Launch properties
  public spawnX: number;
  public spawnY: number;
  public isAiming: boolean = false;
  public aimAngle: number = 0;
  public aimPower: number = 190;
  public isReady: boolean = false;
  public isSelectedForAim: boolean = false;

  public onSpawnFrostZone?: (ball: Ball, x: number, y: number, radius: number, duration: number) => void;
  public onSpawnToxicPools?: (ball: Ball, pools: { x: number; y: number; radius: number; duration: number }[]) => void;
  public onSpawnLightningHazard?: (ball: Ball, points: { x: number; y: number }[], duration: number) => void;
  public onSpawnMeteorShower?: (ball: Ball) => void;
  public onSpawnMinion?: (minion: Ball) => void;
  public isMinion: boolean = false;
  public ownerId: string | null = null;
  public minionLifetime: number = 0;
  public baseTargetSpeed: number = 160;
  public slimeSplitCount: number = 0;
  public slimeSplitProcessed: boolean = false;
  public voltEmittingPoints: { x: number; y: number }[] = [];
  public voltHitCooldown: number = 0;
  public latchedTargetId: string | null = null;
  public latchedByVampireId: string | null = null;
  public latchTimer: number = 0;
  public latchCooldown: number = 0;
  public latchDrainTimer: number = 0;
  public facingAngle: number = 0;
  public voidBlackHoleX: number = 0;
  public voidBlackHoleY: number = 0;
  public axeAngle: number = 0;
  public axePreviousAngle: number = 0;
  public axeHitCooldowns: Record<string, boolean> = {};
  public daggerStock: number = 0;
  public daggerSpawnTimer: number = 0;
  public daggerThrowTimer: number = 0;

  constructor(typeId: BallTypeId, x: number, y: number, vx?: number, vy?: number) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.typeId = typeId;
    const config = BALL_CONFIGS[typeId];

    this.skin = config.skin;
    this.skill = config.skill;
    this.skillStrategy = createSkillStrategy(typeId);
    this.radius = config.baseRadius;
    this.mass = (this.radius * this.radius) / 400; // mass proportional to area
    this.maxHp = config.baseHp;
    this.hp = this.maxHp;
    this.baseAttack = config.baseAttack;
    this.baseTargetSpeed = this.targetSpeed;

    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;

    // Random initial velocity if not provided
    if (vx !== undefined && vy !== undefined) {
      this.vx = vx;
      this.vy = vy;
    } else {
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * this.targetSpeed;
      this.vy = Math.sin(angle) * this.targetSpeed;
    }
    this.facingAngle = Math.hypot(this.vx, this.vy) > 0.01 ? Math.atan2(this.vy, this.vx) : 0;

    // Start with full cooldown so skills require charging
    this.cooldownTimer = this.skill.cooldown;
  }

  public update(dt: number, allBalls: Ball[], vfx: ParticleSystem, isBattleMode: boolean) {
    if (this.isDead) return;

    // Minion lifecycle & AI logic
    if (this.isMinion) {
      if (this.ownerId) {
        const owner = allBalls.find((b) => b.id === this.ownerId && !b.isDead);
        if (!owner) {
          this.isDead = true;
          vfx.emitSparks(this.x, this.y, '#e2e8f0', 8, 100);
          return;
        }
      }

      // Gentle homing AI: steer towards nearest living enemy
      if (!this.isFrozen()) {
        const target = allBalls
          .filter((b) => !b.isDead && b.id !== this.id && b.id !== this.ownerId && b.ownerId !== this.ownerId)
          .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
        if (target) {
          const dx = target.x - this.x;
          const dy = target.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1) {
            const steerForce = 120 * dt;
            this.vx += (dx / dist) * steerForce;
            this.vy += (dy / dist) * steerForce;
          }
        }
      }
    }

    if (this.voltHitCooldown > 0) {
      this.voltHitCooldown -= dt;
    }
    if (this.latchCooldown > 0) {
      this.latchCooldown -= dt;
    }

    // Passive updates for specific hero strategies (e.g. Axe rotation)
    this.skillStrategy.updateTick?.(this, dt, allBalls, vfx, isBattleMode);

    // 1. Process Status Effects (e.g. Frozen, Burning)
    if (this.clownMarks > 0) {
      this.clownMarkTimer -= dt;
      if (this.clownMarkTimer <= 0) {
        this.clownMarks = 0;
        this.clownMarkTimer = 0;
      }
    }
    let speedMultiplier = 1.0;
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const effect = this.statusEffects[i];
      effect.duration -= dt;

      if (effect.type === 'FROZEN_SOLID') {
        speedMultiplier = 0;
        this.vx = 0;
        this.vy = 0;
        if (Math.random() < 0.25) {
          vfx.emitSparks(this.x, this.y, '#bae6fd', 1, 35);
        }
      } else if (effect.type === 'FROZEN') {
        speedMultiplier *= 0.4; // Giảm 60% tốc độ
        // Frost smoke
        if (Math.random() < 0.2) {
          vfx.emitTrail(this.x, this.y, '#93c5fd', this.radius * 0.5);
        }
      } else if (effect.type === 'BURNING') {
        if (isBattleMode) {
          this.hp -= 12 * dt;
          if (this.hp <= 0) {
            this.hp = 0;
            this.die(vfx);
          }
        }
        if (Math.random() < 0.25) {
          vfx.emitSparks(this.x, this.y, '#f97316', 1, 80);
        }
      } else if (effect.type === 'POISONED') {
        if (isBattleMode) {
          effect.poisonTickTimer = (effect.poisonTickTimer || 0) + dt;
          if (effect.poisonTickTimer >= 1.0) {
            effect.poisonTickTimer -= 1.0;
            // Lingering poison damage after leaving puddle: 3 HP/s (1-5 HP/s range)
            this.takeDamage(3, null, vfx, true);
          }
        }
        if (Math.random() < 0.28) {
          vfx.emitTrail(this.x, this.y, '#34d399', this.radius * 0.45);
        }
      } else if (effect.type === 'ELECTRIFIED') {
        if (Math.random() < 0.35) {
          vfx.emitSparks(this.x, this.y, '#fde047', 1, 45);
        }
      } else if (effect.type === 'BLEEDING') {
        if (isBattleMode) {
          effect.bleedTickTimer = (effect.bleedTickTimer || 0) + dt;
          if (effect.bleedTickTimer >= 0.5) {
            effect.bleedTickTimer -= 0.5;
            this.takeDamage(2, null, vfx, true); // 4 HP/s bleed
            vfx.emitSparks(this.x, this.y, '#dc2626', 2, 70);
          }
        }
        if (Math.random() < 0.3) {
          vfx.emitTrail(this.x, this.y, '#e11d48', this.radius * 0.45);
        }
      }

      if (effect.duration <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }

    // 2. Skill Timers & Triggers
    if (this.isSkillActive) {
      if (!this.isFrozen()) {
        this.skillActiveTimer -= dt;
        this.skillStrategy.onActiveTick?.(this, dt, allBalls, vfx, isBattleMode);

        if (this.skillActiveTimer <= 0) {
          this.skillStrategy.onEnd?.(this, allBalls, vfx, isBattleMode);
          this.isSkillActive = false;
          this.cooldownTimer = this.skillStrategy.getNextCooldown?.(this) ?? this.skill.cooldown;
        }
      }
    } else {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0 && !this.isFrozen()) {
        this.activateSkill(allBalls, vfx);
      }
    }

    // 3. Speed regulation (ensure ball keeps energetic dynamic pace)
    let currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const minSpeed = this.targetSpeed * 0.7;
    const skillMax = this.skillStrategy.getMaxSpeed?.(this);
    const maxSpeed = skillMax ?? this.targetSpeed * 1.6;

    if (currentSpeed < minSpeed && currentSpeed > 0.001) {
      const factor = minSpeed / currentSpeed;
      this.vx *= factor;
      this.vy *= factor;
      currentSpeed = minSpeed;
    } else if (currentSpeed <= 0.001 && !this.isFrozenSolid()) {
      // When freeze expires or velocity is 0, give initial impulse so the ball continues playing
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * minSpeed;
      this.vy = Math.sin(angle) * minSpeed;
      currentSpeed = minSpeed;
    } else if (currentSpeed > maxSpeed) {
      // Smoothly dampen excess speed
      const damping = Math.pow(0.5, dt * 3);
      this.vx *= damping;
      this.vy *= damping;
    }

    // 4. Update Position
    this.x += this.vx * speedMultiplier * dt;
    this.y += this.vy * speedMultiplier * dt;

    if (this.isAiming) {
      this.facingAngle = this.aimAngle;
    } else if (Math.hypot(this.vx, this.vy) > 0.01) {
      this.facingAngle = Math.atan2(this.vy, this.vx);
    }

    // Visual spin based on movement
    this.spinAngle += (this.vx + this.vy) * 0.01;

    // 5. Update Trail
    this.trailTimer += dt;
    const trailCfg = this.skillStrategy.getTrailUpdateConfig?.(this);
    const maxTrail = trailCfg?.maxTrail ?? this.maxTrailLength;
    const trailInterval = trailCfg?.interval ?? 0.02;

    if (this.trailTimer >= trailInterval) {
      this.trailTimer = 0;
      this.trail.unshift({ x: this.x, y: this.y });
      while (this.trail.length > maxTrail) {
        this.trail.pop();
      }
    }

    // Passive particle emission
    const emissionCfg = this.skillStrategy.getPassiveEmissionConfig?.(this);
    const emissionChance = emissionCfg?.chance ?? 0.35;
    const emissionRadiusFactor = emissionCfg?.radiusFactor ?? 0.4;
    if (Math.random() < emissionChance) {
      vfx.emitTrail(this.x, this.y, this.skin.glowColor, this.radius * emissionRadiusFactor);
    }
  }

  public isFrozen(): boolean {
    return this.statusEffects.some((e) => e.type === 'FROZEN' || e.type === 'FROZEN_SOLID');
  }

  public isFrozenSolid(): boolean {
    return this.statusEffects.some((e) => e.type === 'FROZEN_SOLID');
  }

  public activateSkill(allBalls: Ball[], vfx: ParticleSystem) {
    if (this.isFrozen()) return;
    this.isSkillActive = true;
    this.skillActiveTimer = this.skill.duration;
    this.skillStrategy.activate(this, allBalls, vfx);
  }

  public applyStatusEffect(type: StatusEffect['type'], duration: number) {
    const existing = this.statusEffects.find((e) => e.type === type);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
    } else {
      this.statusEffects.push({ type, duration });
    }
  }

  public hasStatusEffect(type: StatusEffect['type']): boolean {
    return this.statusEffects.some((e) => e.type === type);
  }

  public removeStatusEffect(type: StatusEffect['type']) {
    this.statusEffects = this.statusEffects.filter((e) => e.type !== type);
  }

  /**
   * Calculates collision impact damage dealt by this ball.
   * - If frozen solid (bị đóng băng): Deals 0 damage.
   * - If skill strategy defines custom collision damage: Uses strategy damage.
   * - If ELECTRIFIED (nhiễm điện): Deals 30% less collision damage.
   * - For other heroes: Fixed base attack stat.
   */
  public getCollisionDamage(): number {
    if (this.isFrozen()) {
      return 0;
    }
    const skillDmg = this.skillStrategy.getCollisionDamage?.(this);
    if (skillDmg !== undefined && skillDmg !== null) {
      if (skillDmg === 0) return 0;
      let dmg = skillDmg;
      if (this.hasStatusEffect('ELECTRIFIED')) {
        dmg = Math.round(dmg * 0.7);
      }
      return Math.max(1, dmg);
    }
    let dmg = this.baseAttack;
    if (this.hasStatusEffect('ELECTRIFIED')) {
      dmg = Math.round(dmg * 0.7);
    }
    return Math.max(1, dmg);
  }

  public getAxeDamage(): number {
    if (this.isFrozen()) return 0;
    const damage = this.hasStatusEffect('ELECTRIFIED')
      ? Math.round(this.baseAttack * 0.7)
      : this.baseAttack;
    return Math.max(1, damage);
  }

  public getFangDamage(): number {
    if (this.isFrozen()) return 0;
    let dmg = 18;
    if (this.hasStatusEffect('ELECTRIFIED')) {
      dmg = Math.round(dmg * 0.7);
    }
    return Math.max(1, dmg);
  }

  public heal(amount: number, vfx: ParticleSystem, allowOverheal: boolean = false) {
    if (this.isDead || amount <= 0) return;
    const oldHp = this.hp;
    const maxAllowed = allowOverheal ? Math.round(this.maxHp * 1.5) : this.maxHp;
    this.hp = Math.min(maxAllowed, this.hp + amount);
    const actualHealed = this.hp - oldHp;
    if (actualHealed > 0) {
      const displayedHealed = Math.round(actualHealed);
      if (this.hp > this.maxHp) {
        vfx.addFloatingText(this.x, this.y - 12, `+${displayedHealed} 🩸 HUYẾT THUẪN!`, '#f43f5e', 16);
        vfx.emitSparks(this.x, this.y, '#f43f5e', 12, 160);
      } else {
        vfx.addFloatingText(this.x, this.y - 12, `+${displayedHealed} 💚`, '#4ade80', 16);
        vfx.emitSparks(this.x, this.y, '#f43f5e', 8, 120);
      }
    }
  }

  public takeDamage(amount: number, attacker: Ball | null, vfx: ParticleSystem, isSkillDmg: boolean = false) {
    if (this.isDead) return;

    // Tăng 30% sát thương nhận vào nếu đang bị nhiễm điện (tất cả mọi loại sát thương)
    if (this.hasStatusEffect('ELECTRIFIED')) {
      amount = Math.round(amount * 1.3);
    }

    this.hp -= amount;
    if (attacker) {
      attacker.damageDealt += amount;
    }

    const roundedDmg = Math.round(amount);
    if (roundedDmg > 0) {
      const text = isSkillDmg ? `-${roundedDmg} 💥` : `-${roundedDmg}`;
      const textColor = isSkillDmg ? '#fb7185' : '#ffffff';
      vfx.addFloatingText(this.x, this.y, text, textColor, isSkillDmg ? 18 : 14);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      if (attacker) {
        attacker.kills++;
      }
      this.die(vfx);
    }
  }

  public die(vfx: ParticleSystem) {
    if (this.isDead) return;
    this.isDead = true;
    this.latchedTargetId = null;
    this.latchedByVampireId = null;
    this.skillStrategy.onDeath?.(this, vfx);
    soundFX.playDeath();
    vfx.triggerScreenShake(16);
    vfx.emitShockwaveRing(this.x, this.y, this.skin.glowColor, 120, 0.6);
    vfx.emitSparks(this.x, this.y, this.skin.primaryColor, 45, 280);
    vfx.emitSparks(this.x, this.y, '#ffffff', 20, 200);
    vfx.addFloatingText(this.x, this.y, 'BỊ HẠ GỤC!', '#ef4444', 20);
  }

  public render(ctx: CanvasRenderingContext2D, isBattleMode: boolean) {
    if (this.isDead) return;

    ctx.save();

    // 0. Render Skill Underlay (e.g. Void Singularity black hole)
    this.skillStrategy.renderUnderlay?.(this, ctx);

    // 1. Render Motion Trail
    if (this.trail.length > 1) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        const pt = this.trail[i];
        const progress = 1 - i / this.trail.length;
        const customRender = this.skillStrategy.getTrailRenderConfig?.(this, progress, i);

        ctx.beginPath();
        const trailR = customRender?.radius ?? this.radius * (0.3 + progress * 0.5);
        ctx.arc(pt.x, pt.y, trailR, 0, Math.PI * 2);
        ctx.fillStyle = customRender?.color ?? this.skin.trailColor;
        ctx.globalAlpha = customRender?.alpha ?? progress * 0.4;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // 2. Skill Active Aura Glow
    if (this.isSkillActive) {
      const pulse = 1 + Math.sin(Date.now() * 0.015) * 0.2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.55 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = this.skin.glowColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = this.skin.glowColor;
      ctx.shadowBlur = 24;
      ctx.stroke();
    }

    // 3. Main Ball Body (Multi-layer radial gradient)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    // Glowing shadow
    ctx.shadowColor = this.skin.glowColor;
    ctx.shadowBlur = this.isSkillActive ? 22 : 12;

    const grad = ctx.createRadialGradient(
      this.x - this.radius * 0.35,
      this.y - this.radius * 0.35,
      this.radius * 0.1,
      this.x,
      this.y,
      this.radius
    );
    grad.addColorStop(0, this.skin.coreColor);
    grad.addColorStop(0.4, this.skin.primaryColor);
    grad.addColorStop(1, this.skin.secondaryColor);

    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle shiny rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 3.8. Render Skill Overlay (e.g. Vampire Fangs, Orbiting Axe)
    this.skillStrategy.renderOverlay?.(this, ctx);

    // 4. Center Emoji Icon / Rune
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(this.radius * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.skin.icon, this.x, this.y + 1);

    // 5. Status Effect Visuals
    const isFrozenSolid = this.statusEffects.some((e) => e.type === 'FROZEN_SOLID');
    const isFrozen = this.statusEffects.some((e) => e.type === 'FROZEN');
    const isPoisoned = this.statusEffects.some((e) => e.type === 'POISONED');

    if (isFrozenSolid) {
      // Solid Ice Block Casing
      const r = this.radius + 6;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.rect(this.x - r, this.y - r, r * 2, r * 2);
      ctx.fill();
      ctx.stroke();

      // Ice glint line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.x - r + 3, this.y - r + 3);
      ctx.lineTo(this.x + r - 3, this.y - r + 3);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = '14px sans-serif';
      ctx.fillText('🧊', this.x, this.y - this.radius - 14);
    } else if (isFrozen) {
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.fillText('❄️', this.x + this.radius * 0.7, this.y - this.radius * 0.7);
    } else if (isPoisoned) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.fillText('🧪', this.x + this.radius * 0.7, this.y - this.radius * 0.7);
    }

    const isElectrified = this.statusEffects.some((e) => e.type === 'ELECTRIFIED');
    if (isElectrified) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = '12px sans-serif';
      ctx.fillText('⚡', this.x - this.radius * 0.75, this.y - this.radius * 0.75);
    }

    const isBleeding = this.statusEffects.some((e) => e.type === 'BLEEDING');
    if (isBleeding) {
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = '12px sans-serif';
      ctx.fillText('🩸', this.x + this.radius * 0.75, this.y - this.radius * 0.75);
    }

    // 6. UI Over Ball: Health Bar & Cooldown Ring
    if (this.isMinion) {
      const barW = this.radius * 2.2;
      const barH = 3.5;
      const barX = this.x - barW / 2;
      const barY = this.y - this.radius - 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      const hpPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(barX, barY, barW * hpPct, barH);

      // Necrotic binding aura ring around minion
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (isBattleMode) {
      const barW = this.radius * 2.2;
      const barH = 5;
      const barX = this.x - barW / 2;
      const barY = this.y - this.radius - 12;

      // Bar background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      // HP fill
      if (this.hp <= this.maxHp) {
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(barX, barY, barW * hpPct, barH);
      } else {
        // Base 100% green
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(barX, barY, barW, barH);
        // Overheal shield extension
        const overPct = Math.min(0.5, (this.hp - this.maxHp) / this.maxHp);
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 6;
        ctx.fillRect(barX + barW, barY - 1, barW * overPct, barH + 2);
        ctx.shadowBlur = 0;
      }
    }

    // Render clown marks after health bars so the label remains visible above them.
    if (this.clownMarks > 0) {
      const labelY = this.y - this.radius - 23;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(this.x - 23, labelY - 9, 46, 18);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fce7f3';
      ctx.fillText(`🤡 ×${this.clownMarks}`, this.x, labelY);
      ctx.restore();
    }

    if (this.typeId === 'DAGGER' && this.daggerStock > 0) {
      const labelY = this.y - this.radius - 25;
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(this.x - 30, labelY - 10, 60, 20);
      ctx.fillStyle = '#e2e8f0';
      ctx.shadowColor = '#cbd5e1';
      ctx.shadowBlur = 8;
      ctx.fillText(`🗡️ ×${this.daggerStock}`, this.x, labelY);
      ctx.restore();
    }

    // Cooldown indicator ring around ball perimeter
    const cdProgress = Math.max(0, 1 - this.cooldownTimer / this.skill.cooldown);
    if (!this.isMinion && !this.isSkillActive && cdProgress < 1.0) {
      ctx.beginPath();
      ctx.arc(
        this.x,
        this.y,
        this.radius + 5,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * cdProgress
      );
      ctx.strokeStyle = this.skin.glowColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 7. Aim Guide Overlay (When in Sandbox Aiming Phase)
    if (this.isAiming) {
      this.renderAimGuide(ctx);
    }

    ctx.restore();
  }

  public renderAimGuide(ctx: CanvasRenderingContext2D) {
    ctx.save();

    const arrowLen = 52;
    const endX = this.x + Math.cos(this.aimAngle) * arrowLen;
    const endY = this.y + Math.sin(this.aimAngle) * arrowLen;

    // Outer aiming ring
    ctx.strokeStyle = this.isReady ? '#22c55e' : this.skin.glowColor;
    ctx.lineWidth = this.isSelectedForAim ? 3 : 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Trajectory dashed laser line
    ctx.strokeStyle = this.isReady ? 'rgba(34, 197, 94, 0.9)' : 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.isReady ? '#22c55e' : this.skin.glowColor;
    ctx.shadowBlur = 10;
    ctx.setLineDash([5, 4]);

    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(this.aimAngle) * (this.radius + 12), this.y + Math.sin(this.aimAngle) * (this.radius + 12));
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const headLen = 12;
    const headAngle = 0.45;
    ctx.fillStyle = this.isReady ? '#22c55e' : this.skin.glowColor;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLen * Math.cos(this.aimAngle - headAngle),
      endY - headLen * Math.sin(this.aimAngle - headAngle)
    );
    ctx.lineTo(
      endX - headLen * Math.cos(this.aimAngle + headAngle),
      endY - headLen * Math.sin(this.aimAngle + headAngle)
    );
    ctx.closePath();
    ctx.fill();

    // Degree badge placed perpendicular to arrow to prevent collisions
    const deg = Math.round((((this.aimAngle * 180) / Math.PI) % 360 + 360) % 360);
    const perpX = -Math.sin(this.aimAngle);
    const perpY = Math.cos(this.aimAngle);
    const tagX = endX + perpX * 16;
    const tagY = endY + perpY * 16;

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#090e1f';
    ctx.beginPath();
    ctx.arc(tagX, tagY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.isReady ? '#22c55e' : this.skin.glowColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = this.isReady ? '#86efac' : '#f8fafc';
    ctx.fillText(`${deg}°`, tagX, tagY);

    // Ready Status Pill Badge above the ball
    const pillY = this.y - this.radius - 20;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.isReady) {
      ctx.fillStyle = 'rgba(22, 101, 52, 0.9)';
      ctx.fillRect(this.x - 40, pillY - 9, 80, 18);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.x - 40, pillY - 9, 80, 18);
      ctx.fillStyle = '#86efac';
      ctx.fillText('✅ SẴN SÀNG', this.x, pillY);
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(this.x - 46, pillY - 9, 92, 18);
      ctx.strokeStyle = this.isSelectedForAim ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.x - 46, pillY - 9, 92, 18);
      ctx.fillStyle = this.isSelectedForAim ? '#38bdf8' : '#94a3b8';
      ctx.fillText('🎯 KÉO ĐỂ NHẮM', this.x, pillY);
    }

    ctx.restore();
  }
}
