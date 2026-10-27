import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import type { BallTypeId, Vector2D } from '../types';

export interface TrailRenderConfig {
  radius: number;
  color: string;
  alpha: number;
}

export interface TrailUpdateConfig {
  maxTrail: number;
  interval: number;
}

export interface PassiveEmissionConfig {
  chance: number;
  radiusFactor: number;
}

export interface SkillStrategy {
  readonly typeId: BallTypeId;

  /**
   * Called when cooldown timer expires and skill triggers.
   */
  activate(ball: Ball, allBalls: Ball[], vfx: ParticleSystem): void;

  /**
   * Called on every physics sub-step tick (passive updates like Axe rotation).
   */
  updateTick?(ball: Ball, dt: number, allBalls: Ball[], vfx: ParticleSystem, isBattleMode: boolean): void;

  /**
   * Called on every physics sub-step tick ONLY while isSkillActive is true.
   */
  onActiveTick?(ball: Ball, dt: number, allBalls: Ball[], vfx: ParticleSystem, isBattleMode: boolean): void;

  /**
   * Called when skillActiveTimer reaches 0.
   */
  onEnd?(ball: Ball, allBalls: Ball[], vfx: ParticleSystem, isBattleMode: boolean): void;

  /**
   * Called immediately when the match ends, regardless of whether the skill is active.
   */
  onBattleEnd?(ball: Ball, allBalls: Ball[], vfx: ParticleSystem): void;

  /**
   * Called when the ball collides with an arena wall.
   */
  onWallHit?(ball: Ball, contactPoint: Vector2D, vfx: ParticleSystem): void;

  /**
   * Called when the ball is destroyed / killed.
   */
  onDeath?(ball: Ball, vfx: ParticleSystem): void;

  /**
   * Disintegrates/clears any entities or traps owned by this hero strategy inside the given area.
   */
  clearEntitiesInArea?(x: number, y: number, radius: number, vfx: ParticleSystem): void;

  /**
   * Determines next cooldown timer upon skill end (default: ball.skill.cooldown).
   */
  getNextCooldown?(ball: Ball): number;

  /**
   * Collision damage dealt by ball body (return null to use default baseAttack).
   */
  getCollisionDamage?(ball: Ball): number | null;

  /**
   * Maximum allowed speed cap during movement dampening (return null for default).
   */
  getMaxSpeed?(ball: Ball): number | null;

  /**
   * Custom trail length & sample interval.
   */
  getTrailUpdateConfig?(ball: Ball): TrailUpdateConfig | null;

  /**
   * Custom trail visual appearance.
   */
  getTrailRenderConfig?(ball: Ball, progress: number, index: number): TrailRenderConfig | null;

  /**
   * Custom passive trail emission rate.
   */
  getPassiveEmissionConfig?(ball: Ball): PassiveEmissionConfig | null;

  /**
   * Render graphics behind the ball body (e.g. Void Singularity).
   */
  renderUnderlay?(ball: Ball, ctx: CanvasRenderingContext2D): void;

  /**
   * Render graphics on top of the ball body (e.g. Vampire Fangs, Orbiting Axe).
   */
  renderOverlay?(ball: Ball, ctx: CanvasRenderingContext2D): void;
}
