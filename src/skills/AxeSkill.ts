import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export class AxeSkill implements SkillStrategy {
  public readonly typeId = 'AXE';

  public updateTick(ball: Ball, dt: number): void {
    ball.axePreviousAngle = ball.axeAngle;
    ball.axeAngle += dt * 12;
  }

  public activate(ball: Ball, allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playAxeDash();
    vfx.triggerScreenShake(5);
    vfx.addFloatingText(ball.x, ball.y - ball.radius - 12, '🪓 XUNG PHONG!', '#fbbf24', 18);
    vfx.emitSparks(ball.x, ball.y, '#fbbf24', 18, 200);
    vfx.emitShockwaveRing(ball.x, ball.y, '#fbbf24', 75, 0.4);

    const target = allBalls
      .filter((b) => b.id !== ball.id && !b.isDead)
      .sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y))[0];

    let rushAngle = ball.facingAngle;
    if (target) {
      rushAngle = Math.atan2(target.y - ball.y, target.x - ball.x);
    } else if (Math.hypot(ball.vx, ball.vy) > 0.01) {
      rushAngle = Math.atan2(ball.vy, ball.vx);
    }
    ball.vx = Math.cos(rushAngle) * ball.targetSpeed * 2.7;
    ball.vy = Math.sin(rushAngle) * ball.targetSpeed * 2.7;
    ball.facingAngle = rushAngle;
  }

  public onActiveTick(ball: Ball, _dt: number, _allBalls: Ball[], vfx: ParticleSystem): void {
    vfx.emitTrail(ball.x, ball.y, '#fbbf24', ball.radius * 0.85);
    if (Math.random() < 0.4) {
      vfx.emitSparks(ball.x, ball.y, '#fef3c7', 2, 80);
    }
  }

  public getNextCooldown(ball: Ball): number {
    return ball.skill.cooldown - ball.skill.duration;
  }

  public getCollisionDamage(_ball: Ball): number {
    return 0;
  }

  public getMaxSpeed(ball: Ball): number | null {
    return ball.isSkillActive ? ball.targetSpeed * 2.8 : null;
  }

  public renderOverlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    const x = ball.x + Math.cos(ball.axeAngle) * (ball.radius + 25);
    const y = ball.y + Math.sin(ball.axeAngle) * (ball.radius + 25);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ball.axeAngle + Math.PI / 2);
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.lineTo(0, -25);
    ctx.stroke();
    ctx.fillStyle = '#d1d5db';
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(29, -32, 27, -7);
    ctx.quadraticCurveTo(14, 3, 0, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
