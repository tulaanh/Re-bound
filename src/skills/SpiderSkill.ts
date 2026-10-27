import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import type { SkillStrategy } from './SkillStrategy';
import type { Vector2D } from '../types';
import { soundFX } from '../audio/SoundFX';

interface WebAnchor {
  x: number;
  y: number;
}

export class SpiderSkill implements SkillStrategy {
  public readonly typeId = 'SPIDER';
  private webAnchors: WebAnchor[] = [];
  private dotAccumulator: number = 0;

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playWebOverdrive();
    vfx.triggerScreenShake(4);
    vfx.addFloatingText(ball.x, ball.y - ball.radius - 12, '🕸️ TƠ CƯỜNG HÓA!', '#ef4444', 16);
    vfx.emitShockwaveRing(ball.x, ball.y, '#ef4444', 60, 0.35);
  }

  public onActiveTick(ball: Ball, _dt: number, _allBalls: Ball[], vfx: ParticleSystem): void {
    // When overdrive is active, emit crimson sparks along web lines
    if (this.webAnchors.length > 0 && Math.random() < 0.25) {
      const anchor = this.webAnchors[Math.floor(Math.random() * this.webAnchors.length)];
      const t = Math.random();
      const px = anchor.x + (ball.x - anchor.x) * t;
      const py = anchor.y + (ball.y - anchor.y) * t;
      vfx.emitSparks(px, py, '#ef4444', 2, 60);
    }
  }

  public onWallHit(ball: Ball, contactPoint: Vector2D, vfx: ParticleSystem): void {
    if (ball.isDead || ball.isAiming) return;

    // Avoid duplicate anchors if hitting almost the same spot (< 12px)
    const tooClose = this.webAnchors.some(
      (a) => Math.hypot(a.x - contactPoint.x, a.y - contactPoint.y) < 12
    );
    if (tooClose) return;

    this.webAnchors.push({ x: contactPoint.x, y: contactPoint.y });
    soundFX.playWebShoot();
    vfx.emitSparks(contactPoint.x, contactPoint.y, '#e2e8f0', 7, 100);
    vfx.emitShockwaveRing(contactPoint.x, contactPoint.y, '#e2e8f0', 18, 0.25);
  }

  public updateTick(ball: Ball, dt: number, allBalls: Ball[], vfx: ParticleSystem): void {
    if (ball.isDead || ball.isAiming) {
      this.webAnchors = [];
      this.dotAccumulator = 0;
      return;
    }

    if (this.webAnchors.length === 0) return;

    // Pure DoT tick accumulation (4 ticks per second)
    this.dotAccumulator += dt;
    const TICK_INTERVAL = 0.25;

    while (this.dotAccumulator >= TICK_INTERVAL) {
      this.dotAccumulator -= TICK_INTERVAL;
      const isOverdrive = ball.isSkillActive;
      const dmg = isOverdrive ? 6 : 3; // 24 HP/s or 12 HP/s

      for (const target of allBalls) {
        if (target.isDead || target.id === ball.id) continue;
        if (target.ownerId === ball.id || ball.ownerId === target.id) continue;
        if (ball.ownerId !== null && target.ownerId === ball.ownerId) continue;

        let hitWeb = false;
        for (const anchor of this.webAnchors) {
          const dist = this.distToSegment(target.x, target.y, anchor.x, anchor.y, ball.x, ball.y);
          if (dist <= target.radius + 3) {
            hitWeb = true;
            break;
          }
        }

        if (hitWeb) {
          target.takeDamage(dmg, ball, vfx, isOverdrive);
          vfx.emitSparks(target.x, target.y, isOverdrive ? '#ef4444' : '#e2e8f0', 3, 60);
        }
      }
    }
  }

  public onDeath(ball: Ball, vfx: ParticleSystem): void {
    for (const anchor of this.webAnchors) {
      vfx.emitSparks(anchor.x, anchor.y, '#94a3b8', 5, 80);
      const midX = (anchor.x + ball.x) / 2;
      const midY = (anchor.y + ball.y) / 2;
      vfx.emitSparks(midX, midY, '#94a3b8', 4, 70);
    }
    this.webAnchors = [];
    this.dotAccumulator = 0;
  }

  public onBattleEnd(): void {
    this.webAnchors = [];
    this.dotAccumulator = 0;
  }

  public clearEntitiesInArea(x: number, y: number, radius: number, vfx: ParticleSystem): void {
    for (let i = this.webAnchors.length - 1; i >= 0; i--) {
      const anchor = this.webAnchors[i];
      if (Math.hypot(anchor.x - x, anchor.y - y) <= radius) {
        vfx.emitSparks(anchor.x, anchor.y, '#a855f7', 8, 90);
        vfx.emitShockwaveRing(anchor.x, anchor.y, '#c084fc', 20, 0.2);
        this.webAnchors.splice(i, 1);
      }
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  public renderUnderlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    if (ball.isDead || this.webAnchors.length === 0) return;

    ctx.save();
    const isOverdrive = ball.isSkillActive;

    // Glowing web silk lines
    ctx.lineCap = 'round';
    ctx.lineWidth = isOverdrive ? 2.5 : 1.8;
    ctx.strokeStyle = isOverdrive ? 'rgba(239, 68, 68, 0.95)' : 'rgba(226, 232, 240, 0.75)';
    ctx.shadowColor = isOverdrive ? '#ef4444' : 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = isOverdrive ? 10 : 4;

    for (const anchor of this.webAnchors) {
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();

      // Wall anchor knot
      ctx.fillStyle = isOverdrive ? '#f87171' : '#ffffff';
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, isOverdrive ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  public renderOverlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    if (ball.isDead) return;

    // Draw active overdrive pulsing aura ring
    if (ball.isSkillActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
