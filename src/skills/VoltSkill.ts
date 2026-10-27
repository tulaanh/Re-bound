import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export class VoltSkill implements SkillStrategy {
  public readonly typeId = 'VOLT';

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playVoltZap();
    vfx.triggerScreenShake(3);
    vfx.addFloatingText(ball.x, ball.y, '⚡ VỆT SÉT!', '#fde047', 16);
    vfx.emitShockwaveRing(ball.x, ball.y, '#fde047', 45, 0.25);
    ball.voltEmittingPoints = [{ x: ball.x, y: ball.y }];
  }

  public onActiveTick(ball: Ball, _dt: number, _allBalls: Ball[], vfx: ParticleSystem): void {
    // Record path points while moving during 0.5s emission
    const lastPt = ball.voltEmittingPoints[ball.voltEmittingPoints.length - 1];
    if (!lastPt || Math.hypot(ball.x - lastPt.x, ball.y - lastPt.y) >= 8) {
      ball.voltEmittingPoints.push({ x: ball.x, y: ball.y });
    }
    if (Math.random() < 0.6) {
      vfx.emitSparks(ball.x, ball.y, '#fde047', 2, 70);
    }
  }

  public onEnd(ball: Ball, _allBalls: Ball[], _vfx: ParticleSystem, _isBattleMode: boolean): void {
    // End of 0.5s emission: ensure final position is recorded & spawn persistent 1.5s lightning hazard
    const lastPt = ball.voltEmittingPoints[ball.voltEmittingPoints.length - 1];
    if (!lastPt || Math.hypot(ball.x - lastPt.x, ball.y - lastPt.y) >= 2) {
      ball.voltEmittingPoints.push({ x: ball.x, y: ball.y });
    }
    if (ball.voltEmittingPoints.length >= 2 && ball.onSpawnLightningHazard) {
      ball.onSpawnLightningHazard(ball, [...ball.voltEmittingPoints], 1.5);
    }
    ball.voltEmittingPoints = [];
  }
}
