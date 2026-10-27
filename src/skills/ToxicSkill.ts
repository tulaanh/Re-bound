import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export class ToxicSkill implements SkillStrategy {
  public readonly typeId = 'TOXIC';

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playToxicSplatter();
    vfx.triggerScreenShake(6);
    vfx.addFloatingText(ball.x, ball.y, '🧪 3 BÃI ĐỘC!', '#34d399', 18);
    vfx.emitShockwaveRing(ball.x, ball.y, '#34d399', 90, 0.45);
    vfx.emitSparks(ball.x, ball.y, '#10b981', 25, 220);

    // Direction of current velocity
    let dirX = ball.vx;
    let dirY = ball.vy;
    let currentVel = Math.sqrt(dirX * dirX + dirY * dirY);
    if (currentVel < 0.01) {
      const randAngle = Math.random() * Math.PI * 2;
      dirX = Math.cos(randAngle);
      dirY = Math.sin(randAngle);
      currentVel = 1;
    }
    const forwardAngle = Math.atan2(dirY / currentVel, dirX / currentVel);

    // 3 enlarged puddles (radius 28px) thrown forward in a fan trap
    // Center pool is placed further forward (72px), side pools spread wider (±48 deg at 56px)
    const poolRadius = 28;
    const spawnedPools = [
      {
        x: ball.x + Math.cos(forwardAngle) * 72,
        y: ball.y + Math.sin(forwardAngle) * 72,
        radius: poolRadius,
        duration: 4.0,
      },
      {
        x: ball.x + Math.cos(forwardAngle - 0.84) * 56,
        y: ball.y + Math.sin(forwardAngle - 0.84) * 56,
        radius: poolRadius,
        duration: 4.0,
      },
      {
        x: ball.x + Math.cos(forwardAngle + 0.84) * 56,
        y: ball.y + Math.sin(forwardAngle + 0.84) * 56,
        radius: poolRadius,
        duration: 4.0,
      },
    ];

    if (ball.onSpawnToxicPools) {
      ball.onSpawnToxicPools(ball, spawnedPools);
    }
  }
}
