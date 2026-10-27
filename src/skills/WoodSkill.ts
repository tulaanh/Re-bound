import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import type { SkillStrategy } from './SkillStrategy';

interface Seed {
  x: number;
  y: number;
  age: number;
}

const SEED_INTERVAL = 3;
const SEED_GROWTH_DURATION = 4;
const SEED_LIFETIME = 8;
const SEED_MAX_RADIUS = 18;
const SEED_DAMAGE = 12;
const SEED_HEAL = 14;

export class WoodSkill implements SkillStrategy {
  public readonly typeId = 'WOOD';
  private seedTimer = SEED_INTERVAL;
  private readonly seeds: Seed[] = [];

  public activate(_ball: Ball, _allBalls: Ball[], _vfx: ParticleSystem): void {
    // Seed creation and growth are handled continuously by updateTick.
  }

  public onBattleEnd(): void {
    this.seeds.length = 0;
    this.seedTimer = SEED_INTERVAL;
  }

  public clearEntitiesInArea(x: number, y: number, radius: number, vfx: ParticleSystem): void {
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const seed = this.seeds[i];
      if (Math.hypot(seed.x - x, seed.y - y) <= radius + this.getSeedRadius(seed)) {
        vfx.emitSparks(seed.x, seed.y, '#a855f7', 8, 90);
        vfx.emitShockwaveRing(seed.x, seed.y, '#c084fc', 20, 0.2);
        this.seeds.splice(i, 1);
      }
    }
  }

  public updateTick(ball: Ball, dt: number, allBalls: Ball[], vfx: ParticleSystem): void {
    if (ball.isDead) return;
    if (ball.isAiming) {
      this.seeds.length = 0;
      this.seedTimer = SEED_INTERVAL;
      return;
    }

    this.seedTimer -= dt;
    while (this.seedTimer <= 0) {
      this.seedTimer += SEED_INTERVAL;
      const angle = Math.random() * Math.PI * 2;
      const distance = ball.radius + 9;
      this.seeds.push({
        x: ball.x + Math.cos(angle) * distance,
        y: ball.y + Math.sin(angle) * distance,
        age: 0,
      });
      vfx.emitSparks(ball.x + Math.cos(angle) * distance, ball.y + Math.sin(angle) * distance, '#86efac', 5, 55);
    }

    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const seed = this.seeds[i];
      seed.age += dt;

      if (seed.age >= SEED_LIFETIME) {
        this.seeds.splice(i, 1);
        continue;
      }

      const seedRadius = this.getSeedRadius(seed);
      const target = allBalls.find((other) => {
        if (other.isDead || other.id === ball.id || other.id === ball.ownerId || other.ownerId === ball.id) return false;
        if (ball.ownerId !== null && other.ownerId === ball.ownerId) return false;
        return Math.hypot(other.x - seed.x, other.y - seed.y) <= other.radius + seedRadius;
      });

      if (!target) continue;

      const hpBefore = target.hp;
      target.takeDamage(SEED_DAMAGE, ball, vfx, true);
      const actualDamage = hpBefore - target.hp;
      if (actualDamage > 0) {
        ball.heal(SEED_HEAL, vfx);
        vfx.emitShockwaveRing(seed.x, seed.y, '#4ade80', 45, 0.3);
        vfx.emitSparks(seed.x, seed.y, '#86efac', 12, 150);
        vfx.addFloatingText(seed.x, seed.y - 12, '🌱 NẢY MẦM!', '#4ade80', 15);
      }
      this.seeds.splice(i, 1);
    }
  }

  public renderUnderlay(_ball: Ball, ctx: CanvasRenderingContext2D): void {
    for (const seed of this.seeds) {
      const radius = this.getSeedRadius(seed);
      const pulse = 1 + Math.sin(seed.age * 5) * 0.08;

      ctx.save();
      ctx.translate(seed.x, seed.y);
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 10;
      ctx.fillStyle = seed.age >= SEED_GROWTH_DURATION ? '#4ade80' : '#a3e635';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-radius * pulse * 0.65, -radius * pulse, radius * pulse * 1.3, radius * pulse * 2);
      ctx.strokeStyle = '#dcfce7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-radius * pulse * 0.65, -radius * pulse, radius * pulse * 1.3, radius * pulse * 2);
      ctx.restore();
    }
  }

  private getSeedRadius(seed: Seed): number {
    const growth = Math.min(1, seed.age / SEED_GROWTH_DURATION);
    return 5 + (SEED_MAX_RADIUS - 5) * growth;
  }
}
