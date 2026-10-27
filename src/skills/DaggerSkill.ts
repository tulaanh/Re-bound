import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';

/** The dagger hero's attacks are simulated by GameEngine's pickup/projectile loop. */
export class DaggerSkill implements SkillStrategy {
  public readonly typeId = 'DAGGER';

  public activate(_ball: Ball, _allBalls: Ball[], _vfx: ParticleSystem): void {}
}