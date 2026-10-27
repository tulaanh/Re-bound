import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';

export class MeteorSkill implements SkillStrategy {
  public readonly typeId = 'METEOR';

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    vfx.triggerScreenShake(4);
    vfx.addFloatingText(ball.x, ball.y, '☄️ MƯA THIÊN THẠCH!', '#fb923c', 18);
    vfx.emitShockwaveRing(ball.x, ball.y, '#fb923c', 90, 0.45);
  }

  public onActiveTick(ball: Ball, _dt: number, _allBalls: Ball[], vfx: ParticleSystem): void {
    if (Math.random() < 0.35) {
      vfx.emitTrail(ball.x, ball.y, '#fb923c', ball.radius * 0.55);
    }
  }

  public onEnd(ball: Ball, _allBalls: Ball[], _vfx: ParticleSystem, _isBattleMode: boolean): void {
    ball.onSpawnMeteorShower?.(ball);
  }

  public getNextCooldown(ball: Ball): number {
    return ball.skill.cooldown - ball.skill.duration;
  }
}
