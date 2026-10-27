import type { Ball } from '../entities/Ball';

export interface BallCollisionResult {
  ballA: Ball;
  ballB: Ball;
  contactX: number;
  contactY: number;
  relativeSpeed: number;
  normalX: number;
  normalY: number;
}

export class CollisionResolver {
  /**
   * Detects and resolves collision between two balls, applying position correction
   * and 2D elastic impulse response.
   */
  public static resolveBalls(b1: Ball, b2: Ball): BallCollisionResult | null {
    if (
      b1.isDead ||
      b2.isDead ||
      b1.latchedTargetId !== null ||
      b2.latchedTargetId !== null ||
      b1.latchedByVampireId !== null ||
      b2.latchedByVampireId !== null
    ) {
      return null;
    }

    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const distSq = dx * dx + dy * dy;
    const minDist = b1.radius + b2.radius;

    if (distSq >= minDist * minDist) {
      return null;
    }

    const dist = Math.sqrt(distSq);
    let nx = 1;
    let ny = 0;

    if (dist > 0.0001) {
      nx = dx / dist;
      ny = dy / dist;
    }

    // 1. Positional Separation (prevent overlap / sticky balls)
    const overlap = minDist - dist;
    const totalMass = b1.mass + b2.mass;
    const ratio1 = b2.mass / totalMass;
    const ratio2 = b1.mass / totalMass;

    b1.x -= nx * overlap * ratio1;
    b1.y -= ny * overlap * ratio1;
    b2.x += nx * overlap * ratio2;
    b2.y += ny * overlap * ratio2;

    // 2. Relative Velocity along collision normal
    const relVx = b1.vx - b2.vx;
    const relVy = b1.vy - b2.vy;
    const velAlongNormal = relVx * nx + relVy * ny;

    // If already moving away, do not resolve impulses again
    if (velAlongNormal <= 0) {
      const contactX = b1.x + nx * b1.radius;
      const contactY = b1.y + ny * b1.radius;
      const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
      return {
        ballA: b1,
        ballB: b2,
        contactX,
        contactY,
        relativeSpeed: relSpeed,
        normalX: nx,
        normalY: ny,
      };
    }

    // 3. Elastic impulse calculation
    const restitution = 0.98;
    const impulseMag = (-(1 + restitution) * velAlongNormal) / (1 / b1.mass + 1 / b2.mass);

    const impX = impulseMag * nx;
    const impY = impulseMag * ny;

    b1.vx += impX / b1.mass;
    b1.vy += impY / b1.mass;
    b2.vx -= impX / b2.mass;
    b2.vy -= impY / b2.mass;

    // Contact point and relative speed for VFX & Audio
    const contactX = b1.x + nx * b1.radius;
    const contactY = b1.y + ny * b1.radius;
    const relativeSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

    return {
      ballA: b1,
      ballB: b2,
      contactX,
      contactY,
      relativeSpeed,
      normalX: nx,
      normalY: ny,
    };
  }
}
