import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import type { SkillStrategy } from './SkillStrategy';

interface TitanStone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lifetime: number;
}

const STONE_INTERVAL = 1.5;
const STONE_SPEED = 420;
const STONE_DAMAGE = 20;

export class TitanSkill implements SkillStrategy {
  public readonly typeId = 'TITAN';
  private stones: TitanStone[] = [];
  private stoneTimer = STONE_INTERVAL;
  private baseRadius = 0;
  private baseMass = 0;
  private baseMaxHp = 0;
  private baseAttack = 0;
  private isTransformed = false;

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    this.baseRadius = ball.radius;
    this.baseMass = ball.mass;
    this.baseMaxHp = ball.maxHp;
    this.baseAttack = ball.baseAttack;
    this.isTransformed = true;
    this.stones = [];
    this.stoneTimer = STONE_INTERVAL;

    ball.radius = this.baseRadius * 1.6;
    ball.mass = (ball.radius * ball.radius) / 400;
    ball.maxHp = this.baseMaxHp + 30;
    ball.hp = Math.min(Math.round(this.baseMaxHp * 1.5), ball.hp + 30);
    ball.baseAttack = this.baseAttack + 10;

    vfx.addFloatingText(ball.x, ball.y - ball.radius, '🗿 HÓA THÂN KHỔNG LỒ!', '#fbbf24', 20);
    vfx.emitShockwaveRing(ball.x, ball.y, '#f59e0b', 110, 0.55);
    vfx.emitSparks(ball.x, ball.y, '#fbbf24', 22, 210);
    vfx.triggerScreenShake(8);
  }

  public onActiveTick(ball: Ball, dt: number, allBalls: Ball[], vfx: ParticleSystem): void {
    if (ball.skillActiveTimer > 0) {
      this.stoneTimer -= dt;
      while (this.stoneTimer <= 0) {
        this.throwStone(ball, vfx);
        this.stoneTimer += STONE_INTERVAL;
      }
    }

    for (let i = this.stones.length - 1; i >= 0; i--) {
      const stone = this.stones[i];
      stone.x += stone.vx * dt;
      stone.y += stone.vy * dt;
      stone.lifetime -= dt;

      const target = allBalls.find((other) =>
        other.id !== ball.id && !other.isDead &&
        Math.hypot(other.x - stone.x, other.y - stone.y) <= other.radius + stone.radius
      );

      if (target) {
        target.takeDamage(STONE_DAMAGE, ball, vfx, true);
        vfx.emitSparks(stone.x, stone.y, '#d6d3d1', 12, 150);
        vfx.emitShockwaveRing(stone.x, stone.y, '#f59e0b', 34, 0.22);
        this.stones.splice(i, 1);
      } else if (stone.lifetime <= 0) {
        this.stones.splice(i, 1);
      }
    }

    if (Math.random() < 0.55) {
      vfx.emitTrail(ball.x, ball.y, '#fbbf24', ball.radius * 0.7);
    }
  }

  public onEnd(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    this.onBattleEnd(ball);
    vfx.addFloatingText(ball.x, ball.y - ball.radius, 'HẾT HÓA THÂN', '#d6d3d1', 15);
  }

  public onBattleEnd(ball: Ball): void {
    if (this.isTransformed) {
      ball.radius = this.baseRadius;
      ball.mass = this.baseMass;
      ball.maxHp = this.baseMaxHp;
      ball.hp = Math.min(ball.hp, ball.maxHp);
      ball.baseAttack = this.baseAttack;
      this.isTransformed = false;
    }
    this.stones = [];
    this.stoneTimer = STONE_INTERVAL;
  }

  public renderOverlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    for (const stone of this.stones) {
      ctx.save();
      ctx.translate(stone.x, stone.y);
      ctx.rotate(Math.atan2(stone.vy, stone.vx) + Math.PI / 4);
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#78716c';
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-stone.radius, -stone.radius * 0.45);
      ctx.lineTo(-stone.radius * 0.5, -stone.radius);
      ctx.lineTo(stone.radius * 0.65, -stone.radius * 0.75);
      ctx.lineTo(stone.radius, stone.radius * 0.25);
      ctx.lineTo(stone.radius * 0.35, stone.radius);
      ctx.lineTo(-stone.radius * 0.75, stone.radius * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (ball.isSkillActive && this.isTransformed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private throwStone(ball: Ball, vfx: ParticleSystem): void {
    const angle = ball.facingAngle;
    const radius = 27;
    const x = ball.x + Math.cos(angle) * (ball.radius + radius + 3);
    const y = ball.y + Math.sin(angle) * (ball.radius + radius + 3);
    this.stones.push({
      x,
      y,
      vx: Math.cos(angle) * STONE_SPEED,
      vy: Math.sin(angle) * STONE_SPEED,
      radius,
      lifetime: 3,
    });
    vfx.emitSparks(x, y, '#d6d3d1', 5, 90);
  }
}