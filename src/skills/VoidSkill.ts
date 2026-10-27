import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export const VOID_SKILL_RADIUS = 150;

export class VoidSkill implements SkillStrategy {
  public readonly typeId = 'VOID';
  private dotAccumulator: number = 0;

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playVoidSingularity();
    vfx.triggerScreenShake(6);
    ball.voidBlackHoleX = ball.x;
    ball.voidBlackHoleY = ball.y;
    this.dotAccumulator = 0;
    vfx.addFloatingText(ball.x, ball.y, '🌌 HỐ ĐEN!', '#c084fc', 18);
    vfx.emitShockwaveRing(ball.x, ball.y, '#c084fc', VOID_SKILL_RADIUS * 1.4, 0.4);
  }

  public onActiveTick(ball: Ball, dt: number, allBalls: Ball[], vfx: ParticleSystem): void {
    const pullRadius = VOID_SKILL_RADIUS;
    const holeX = ball.voidBlackHoleX;
    const holeY = ball.voidBlackHoleY;

    // DoT accumulator: 12 HP/s (3 HP every 0.25s)
    this.dotAccumulator += dt;
    const isTick = this.dotAccumulator >= 0.25;
    if (isTick) {
      this.dotAccumulator -= 0.25;
    }

    // Pull every other ball, vaporize summons, and apply crushing DoT to enemies
    for (const enemy of allBalls) {
      if (enemy.id === ball.id || enemy.isDead) continue;
      if (enemy.ownerId === ball.id) continue;

      const dx = holeX - enemy.x;
      const dy = holeY - enemy.y;
      const dist = Math.hypot(dx, dy);

      if (dist < pullRadius) {
        // A. Summons (Necro skeleton minions) are INSTANTLY VAPORIZED!
        if (enemy.ownerId !== null) {
          enemy.takeDamage(999, ball, vfx, true);
          vfx.emitSparks(enemy.x, enemy.y, '#a855f7', 16, 160);
          vfx.emitShockwaveRing(enemy.x, enemy.y, '#c084fc', 40, 0.35);
          vfx.addFloatingText(enemy.x, enemy.y, '🌀 PHÂN RÃ!', '#c084fc', 16);
          soundFX.playVoidDisintegrate();
          continue;
        }

        // B. Hero balls: strong gravitational pull toward center
        if (dist > 0.01) {
          const force = (1 - dist / pullRadius) * 580 * dt;
          enemy.vx += (dx / dist) * force;
          enemy.vy += (dy / dist) * force;
        }

        // Gravitational crushing DoT
        if (isTick) {
          enemy.takeDamage(3, ball, vfx, true);
          vfx.emitSparks(enemy.x, enemy.y, '#c084fc', 4, 80);
        }

        if (Math.random() < 0.25) {
          vfx.emitTrail(enemy.x, enemy.y, '#c084fc', 4);
        }
      }
    }
  }

  public onEnd(ball: Ball, allBalls: Ball[], vfx: ParticleSystem, _isBattleMode: boolean): void {
    this.dotAccumulator = 0;

    // Collapse the black hole, dealing massive 50 HP blast and resetting victim cooldowns
    vfx.triggerScreenShake(16);
    soundFX.playVoidCollapse();
    vfx.emitShockwaveRing(ball.voidBlackHoleX, ball.voidBlackHoleY, '#e879f9', VOID_SKILL_RADIUS * 1.15, 0.5);
    vfx.emitSparks(ball.voidBlackHoleX, ball.voidBlackHoleY, '#c084fc', 50, 320);
    vfx.emitSparks(ball.voidBlackHoleX, ball.voidBlackHoleY, '#ffffff', 25, 240);
    vfx.addFloatingText(ball.voidBlackHoleX, ball.voidBlackHoleY, '💥 SỤP ĐỔ HƯ KHÔNG!', '#e879f9', 20);

    const blastRadius = VOID_SKILL_RADIUS;
    for (const enemy of allBalls) {
      if (enemy.id !== ball.id && !enemy.isDead && enemy.ownerId !== ball.id) {
        const dx = enemy.x - ball.voidBlackHoleX;
        const dy = enemy.y - ball.voidBlackHoleY;
        const dist = Math.hypot(dx, dy);
        if (dist < blastRadius) {
          enemy.cooldownTimer = enemy.skill.cooldown;
          const safeDist = Math.max(dist, 1);
          const pushSpeed = 260;
          enemy.vx = (dx / safeDist) * pushSpeed;
          enemy.vy = (dy / safeDist) * pushSpeed;
          enemy.takeDamage(50, ball, vfx, true);
        }
      }
    }
  }

  public onBattleEnd(): void {
    this.dotAccumulator = 0;
  }

  public renderUnderlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    if (!ball.isSkillActive) return;

    const pulse = 1 + Math.sin(Date.now() * 0.012) * 0.08;
    const areaRadius = VOID_SKILL_RADIUS * pulse;

    // Clearly show the full pull/destruction range on the arena floor
    ctx.beginPath();
    ctx.arc(ball.voidBlackHoleX, ball.voidBlackHoleY, areaRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
    ctx.fill();
    ctx.setLineDash([9, 6]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.9)';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.setLineDash([]);

    const holeRadius = 32 * (1 + Math.sin(Date.now() * 0.012) * 0.08);
    const gradient = ctx.createRadialGradient(
      ball.voidBlackHoleX,
      ball.voidBlackHoleY,
      2,
      ball.voidBlackHoleX,
      ball.voidBlackHoleY,
      holeRadius
    );
    gradient.addColorStop(0, '#05010a');
    gradient.addColorStop(0.62, '#13051f');
    gradient.addColorStop(0.82, 'rgba(192, 132, 252, 0.85)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.beginPath();
    ctx.arc(ball.voidBlackHoleX, ball.voidBlackHoleY, holeRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 24;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
      ball.voidBlackHoleX,
      ball.voidBlackHoleY,
      holeRadius * 1.6,
      holeRadius * 0.42,
      Date.now() * 0.001,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
