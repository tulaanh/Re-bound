import type { SkillStrategy, TrailRenderConfig, TrailUpdateConfig, PassiveEmissionConfig } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export class BlazeSkill implements SkillStrategy {
  public readonly typeId = 'BLAZE';

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playBlazeDash();
    vfx.triggerScreenShake(9);
    vfx.addFloatingText(ball.x, ball.y, '🔥 BỘC PHÁ 3.0x!', '#ff4500', 20);

    // Surge forward at 3.0x speed (decays smoothly over 4.0s)
    const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
    const surgeSpeed = ball.targetSpeed * 3.0;
    ball.vx = (ball.vx / currentSpeed) * surgeSpeed;
    ball.vy = (ball.vy / currentSpeed) * surgeSpeed;

    vfx.emitShockwaveRing(ball.x, ball.y, '#f97316', 80, 0.45);
    vfx.emitSparks(ball.x, ball.y, '#ff4500', 30, 280);
  }

  public onActiveTick(ball: Ball, _dt: number, _allBalls: Ball[], vfx: ParticleSystem): void {
    // Speed decays smoothly from 3.0x down to 1.0x targetSpeed over 4.0s
    const progress = Math.max(0, Math.min(1, 1 - ball.skillActiveTimer / ball.skill.duration));
    const speedMult = 3.0 - 2.0 * Math.pow(progress, 1.25);
    const desiredSpeed = ball.targetSpeed * speedMult;
    const curSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

    if (curSpeed > 0.001) {
      const factor = desiredSpeed / curSpeed;
      ball.vx *= factor;
      ball.vy *= factor;
    }

    vfx.emitSparks(ball.x, ball.y, '#ff4500', 4, 150);
    vfx.emitTrail(ball.x, ball.y, '#f97316', ball.radius * 0.95);
  }

  public getCollisionDamage(ball: Ball): number {
    const curSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const speedBonus = Math.max(0, (curSpeed - ball.targetSpeed) * 0.15);
    return Math.round(ball.baseAttack + speedBonus);
  }

  public getMaxSpeed(ball: Ball): number | null {
    return ball.isSkillActive ? ball.targetSpeed * 3.5 : null;
  }

  public getTrailUpdateConfig(ball: Ball): TrailUpdateConfig | null {
    return ball.isSkillActive ? { maxTrail: 28, interval: 0.012 } : null;
  }

  public getTrailRenderConfig(ball: Ball, progress: number, index: number): TrailRenderConfig | null {
    if (!ball.isSkillActive) return null;
    return {
      radius: ball.radius * (0.35 + progress * 0.95),
      color: index % 2 === 0 ? '#ff4500' : '#f97316',
      alpha: progress * 0.7,
    };
  }

  public getPassiveEmissionConfig(ball: Ball): PassiveEmissionConfig | null {
    return ball.isSkillActive ? { chance: 0.8, radiusFactor: 0.7 } : null;
  }
}
