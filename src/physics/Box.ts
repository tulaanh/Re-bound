export interface WallHitResult {
  hit: boolean;
  wallNormal: { x: number; y: number };
  contactPoint: { x: number; y: number };
  impactSpeed: number;
}

export class BoxArena {
  public centerX: number;
  public centerY: number;
  public size: number;
  public angle: number = 0; // in radians
  public isRotating: boolean = false;
  public rotationSpeed: number = 0.35; // radians per second
  public restitution: number = 0.99; // high elasticity for lively bounces

  constructor(centerX: number, centerY: number, size: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.size = size;
  }

  public resize(centerX: number, centerY: number, size: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.size = size;
  }

  public update(dt: number) {
    if (this.isRotating) {
      this.angle = (this.angle + this.rotationSpeed * dt) % (Math.PI * 2);
    }
  }

  /**
   * Resolves collision between a ball and the square box walls.
   * Handles both static and rotating box orientations with proper impulse and clamping.
   */
  public resolveBallCollision(ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
  }): WallHitResult {
    const halfSize = this.size / 2;
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);

    // Transform ball pos to Box's local coordinate space
    const dx = ball.x - this.centerX;
    const dy = ball.y - this.centerY;
    let localX = dx * cosA + dy * sinA;
    let localY = -dx * sinA + dy * cosA;

    // Transform ball velocity to local frame
    let localVx = ball.vx * cosA + ball.vy * sinA;
    let localVy = -ball.vx * sinA + ball.vy * cosA;

    let hit = false;
    let localNormalX = 0;
    let localNormalY = 0;
    let impactSpeed = 0;

    const r = ball.radius;
    const minBound = -halfSize + r;
    const maxBound = halfSize - r;

    // Left wall collision
    if (localX < minBound) {
      localX = minBound;
      impactSpeed = Math.max(impactSpeed, Math.abs(localVx));
      localVx = -localVx * this.restitution;
      localNormalX = 1;
      hit = true;
      if (this.isRotating) {
        // Wall tangential velocity transfer: v_y = w * localX
        const wallVy = this.rotationSpeed * (-halfSize);
        localVy += (wallVy - localVy) * 0.15;
      }
    }
    // Right wall collision
    else if (localX > maxBound) {
      localX = maxBound;
      impactSpeed = Math.max(impactSpeed, Math.abs(localVx));
      localVx = -localVx * this.restitution;
      localNormalX = -1;
      hit = true;
      if (this.isRotating) {
        const wallVy = this.rotationSpeed * halfSize;
        localVy += (wallVy - localVy) * 0.15;
      }
    }

    // Top wall collision
    if (localY < minBound) {
      localY = minBound;
      impactSpeed = Math.max(impactSpeed, Math.abs(localVy));
      localVy = -localVy * this.restitution;
      localNormalY = 1;
      hit = true;
      if (this.isRotating) {
        const wallVx = -this.rotationSpeed * (-halfSize);
        localVx += (wallVx - localVx) * 0.15;
      }
    }
    // Bottom wall collision
    else if (localY > maxBound) {
      localY = maxBound;
      impactSpeed = Math.max(impactSpeed, Math.abs(localVy));
      localVy = -localVy * this.restitution;
      localNormalY = -1;
      hit = true;
      if (this.isRotating) {
        const wallVx = -this.rotationSpeed * halfSize;
        localVx += (wallVx - localVx) * 0.15;
      }
    }

    if (hit) {
      // Transform position back to world coordinates
      ball.x = this.centerX + localX * cosA - localY * sinA;
      ball.y = this.centerY + localX * sinA + localY * cosA;

      // Transform velocity back to world coordinates
      ball.vx = localVx * cosA - localVy * sinA;
      ball.vy = localVx * sinA + localVy * cosA;

      // Normal in world coordinates
      const worldNormalX = localNormalX * cosA - localNormalY * sinA;
      const worldNormalY = localNormalX * sinA + localNormalY * cosA;

      return {
        hit: true,
        wallNormal: { x: worldNormalX, y: worldNormalY },
        contactPoint: { x: ball.x, y: ball.y },
        impactSpeed,
      };
    }

    return {
      hit: false,
      wallNormal: { x: 0, y: 0 },
      contactPoint: { x: ball.x, y: ball.y },
      impactSpeed: 0,
    };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const halfSize = this.size / 2;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.angle);

    // Box Background gradient
    const bgGrad = ctx.createRadialGradient(0, 0, 50, 0, 0, halfSize * 1.4);
    bgGrad.addColorStop(0, '#101426');
    bgGrad.addColorStop(0.7, '#090b16');
    bgGrad.addColorStop(1, '#05070f');

    ctx.fillStyle = bgGrad;
    ctx.fillRect(-halfSize, -halfSize, this.size, this.size);

    // Grid lines inside box
    ctx.strokeStyle = 'rgba(79, 110, 247, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    ctx.beginPath();
    for (let x = -halfSize + gridStep; x < halfSize; x += gridStep) {
      ctx.moveTo(x, -halfSize);
      ctx.lineTo(x, halfSize);
    }
    for (let y = -halfSize + gridStep; y < halfSize; y += gridStep) {
      ctx.moveTo(-halfSize, y);
      ctx.lineTo(halfSize, y);
    }
    ctx.stroke();

    // Center circular arena marker
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, halfSize * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing Arena Border
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#6366f1';
    ctx.shadowBlur = 18;
    ctx.strokeRect(-halfSize, -halfSize, this.size, this.size);

    // Bright inner crisp border
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    ctx.strokeRect(-halfSize, -halfSize, this.size, this.size);

    // Corner decorative accents
    const cornerLen = 22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(-halfSize, -halfSize + cornerLen);
    ctx.lineTo(-halfSize, -halfSize);
    ctx.lineTo(-halfSize + cornerLen, -halfSize);
    // Top-Right
    ctx.moveTo(halfSize - cornerLen, -halfSize);
    ctx.lineTo(halfSize, -halfSize);
    ctx.lineTo(halfSize, -halfSize + cornerLen);
    // Bottom-Right
    ctx.moveTo(halfSize, halfSize - cornerLen);
    ctx.lineTo(halfSize, halfSize);
    ctx.lineTo(halfSize - cornerLen, halfSize);
    // Bottom-Left
    ctx.moveTo(-halfSize + cornerLen, halfSize);
    ctx.lineTo(-halfSize, halfSize);
    ctx.lineTo(-halfSize, halfSize - cornerLen);
    ctx.stroke();

    ctx.restore();
  }
}
