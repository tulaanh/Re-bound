import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export class FrostSkill implements SkillStrategy {
  public readonly typeId = 'FROST';

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playFrostNova();
    vfx.triggerScreenShake(7);
    vfx.addFloatingText(ball.x, ball.y, '❄️ VỰC BĂNG 5S!', '#38bdf8', 18);
    vfx.emitShockwaveRing(ball.x, ball.y, '#38bdf8', 130, 0.6);
    vfx.emitSparks(ball.x, ball.y, '#bae6fd', 30, 200);

    if (ball.onSpawnFrostZone) {
      ball.onSpawnFrostZone(ball, ball.x, ball.y, 90, 5);
    }
  }
}
