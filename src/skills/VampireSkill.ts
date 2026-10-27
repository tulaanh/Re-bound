import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export class VampireSkill implements SkillStrategy {
  public readonly typeId = 'VAMPIRE';

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playVampireBite();
    vfx.addFloatingText(ball.x, ball.y, '🩸 CUỒNG NỘ 3S!', '#f43f5e', 20);
    const curSpeedVamp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
    const vampSurgeSpeed = ball.targetSpeed * 2.0;
    ball.vx = (ball.vx / curSpeedVamp) * vampSurgeSpeed;
    ball.vy = (ball.vy / curSpeedVamp) * vampSurgeSpeed;
    vfx.emitShockwaveRing(ball.x, ball.y, '#f43f5e', 75, 0.4);
    vfx.emitSparks(ball.x, ball.y, '#dc2626', 25, 240);
  }

  public onActiveTick(ball: Ball, _dt: number, _allBalls: Ball[], vfx: ParticleSystem): void {
    const curSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const desiredSpeed = ball.targetSpeed * 2.0;
    if (curSpeed > 0.001) {
      const factor = desiredSpeed / curSpeed;
      ball.vx *= factor;
      ball.vy *= factor;
    }
    if (Math.random() < 0.4) {
      vfx.emitTrail(ball.x, ball.y, '#f43f5e', ball.radius * 0.7);
      vfx.emitSparks(ball.x, ball.y, '#dc2626', 2, 80);
    }
  }

  public renderOverlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Determine forward orientation
    const forwardAngle = ball.facingAngle;

    const isEnraged = ball.isSkillActive;
    const fangLen = isEnraged ? 14 : 9.5;
    const fangWidth = isEnraged ? 6.5 : 4.5;

    // Red neon glow if in Blood Frenzy
    if (isEnraged) {
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 14;
    } else {
      ctx.shadowColor = '#e11d48';
      ctx.shadowBlur = 6;
    }

    // Two fangs at angle offsets ±0.34 radians from front
    const fangOffsets = [-0.34, 0.34];

    for (const offset of fangOffsets) {
      const fa = forwardAngle + offset;
      const cosFa = Math.cos(fa);
      const sinFa = Math.sin(fa);

      // Tangent vector for fang base thickness
      const perpX = -sinFa;
      const perpY = cosFa;

      // Base points on ball surface
      const baseX = ball.x + cosFa * (ball.radius - 1.5);
      const baseY = ball.y + sinFa * (ball.radius - 1.5);

      const pLeftX = baseX - perpX * (fangWidth / 2);
      const pLeftY = baseY - perpY * (fangWidth / 2);

      const pRightX = baseX + perpX * (fangWidth / 2);
      const pRightY = baseY + perpY * (fangWidth / 2);

      // Sharp fang tip extending outwards
      const tipX = ball.x + cosFa * (ball.radius + fangLen);
      const tipY = ball.y + sinFa * (ball.radius + fangLen);

      // Draw fang polygon
      ctx.beginPath();
      ctx.moveTo(pLeftX, pLeftY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(pRightX, pRightY);
      ctx.closePath();

      // Ivory white base blending to blood-red tip
      const fangGrad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
      fangGrad.addColorStop(0, '#ffffff');
      fangGrad.addColorStop(0.5, '#fff1f2');
      fangGrad.addColorStop(1, '#dc2626');

      ctx.fillStyle = fangGrad;
      ctx.fill();

      ctx.strokeStyle = isEnraged ? '#f43f5e' : '#881337';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.restore();
  }
}
