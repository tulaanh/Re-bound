import type { Particle, FloatingText } from '../types';

export class ParticleSystem {
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  public shakeIntensity: number = 0;

  public triggerScreenShake(intensity: number) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 25);
  }

  public getScreenShakeOffset(): { x: number; y: number } {
    if (this.shakeIntensity <= 0.2) {
      return { x: 0, y: 0 };
    }
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.shakeIntensity;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  }

  public emitSparks(x: number, y: number, color: string, count: number = 10, speed: number = 180) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: 2.5 + Math.random() * 3.5,
        alpha: 1.0,
        decay: 1.2 + Math.random() * 1.5,
        shape: 'spark',
      });
    }
  }

  public emitShockwaveRing(x: number, y: number, color: string, maxRadius: number = 90, duration: number = 0.5) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      color,
      size: 3,
      alpha: 1.0,
      decay: 1 / duration,
      shape: 'ring',
      ringRadius: 10,
      ringMaxRadius: maxRadius,
    });
  }

  public emitTrail(x: number, y: number, color: string, radius: number = 6) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      color,
      size: radius * (0.4 + Math.random() * 0.4),
      alpha: 0.6,
      decay: 2.5,
      shape: 'smoke',
    });
  }

  public addFloatingText(x: number, y: number, text: string, color: string = '#ffffff', fontSize: number = 16) {
    this.floatingTexts.push({
      id: Math.random().toString(36).substring(2, 9),
      x: x + (Math.random() - 0.5) * 20,
      y: y - 10,
      text,
      color,
      alpha: 1.0,
      vy: -55 - Math.random() * 25,
      life: 0,
      maxLife: 0.85,
      fontSize,
    });
  }

  public update(dt: number) {
    // Screen shake decay
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - 45 * dt);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;

      if (p.shape === 'ring' && p.ringRadius !== undefined && p.ringMaxRadius !== undefined) {
        const progress = 1 - Math.max(0, p.alpha);
        p.ringRadius = 10 + (p.ringMaxRadius - 10) * progress;
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, 1 - (ft.life / ft.maxLife));
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Render particles with additive glow
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      if (p.alpha <= 0) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      if (p.shape === 'ring' && p.ringRadius !== undefined) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.alpha), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render floating combat texts
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of this.floatingTexts) {
      if (ft.alpha <= 0) continue;
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${ft.fontSize}px 'Outfit', sans-serif, system-ui`;

      // Text stroke for contrast
      ctx.strokeStyle = '#050510';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);

      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    ctx.restore();
  }

  public clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.shakeIntensity = 0;
  }
}
