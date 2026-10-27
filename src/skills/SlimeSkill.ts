import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';

/** Slime's defining passive is handled by GameEngine when it dies. */
export class SlimeSkill implements SkillStrategy {
  public readonly typeId = 'SLIME';

  public activate(_ball: Ball, _allBalls: Ball[], _vfx: ParticleSystem): void {
    // Splitting is triggered exactly once by the engine's death handling.
  }
}