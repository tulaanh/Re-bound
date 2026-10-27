import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

const MAX_RAGE = 100;
const RAGE_PER_SECOND = 12;
const MIN_SKILL_DAMAGE = 16;
const MAX_SKILL_DAMAGE = 90;
const BEAM_LENGTH = 1200;
const BEAM_WIDTH = 26;
const BEAM_SPEED = 900;

export class GokuSkill implements SkillStrategy {
  public readonly typeId = 'GOKU';

  public updateTick(ball: Ball, dt: number, allBalls: Ball[], vfx: ParticleSystem): void {
    if (ball.gokuCollisionCooldown <= 0 && ball.gokuRage < MAX_RAGE) {
      ball.gokuRage = Math.min(MAX_RAGE, ball.gokuRage + RAGE_PER_SECOND * dt);
    }

    ball.gokuCollisionCooldown = Math.max(0, ball.gokuCollisionCooldown - dt);

    if (Math.random() < 0.16) {
      vfx.emitTrail(ball.x, ball.y, ball.skin.glowColor, ball.radius * 0.5);
    }

    // Keep the signature's battle context behaviorally consistent with other skills.
    void allBalls;
  }

  public activate(ball: Ball, allBalls: Ball[], vfx: ParticleSystem): void {
    const rageRatio = ball.gokuRage / MAX_RAGE;
    const damage = Math.round((MIN_SKILL_DAMAGE + (MAX_SKILL_DAMAGE - MIN_SKILL_DAMAGE) * rageRatio) * 0.7);
    ball.gokuSkillDamage = damage;

    const nearestOpponent = allBalls.reduce<Ball | null>((nearest, candidate) => {
      if (
        candidate.id === ball.id ||
        candidate.isDead ||
        candidate.isMinion ||
        candidate.id === ball.ownerId ||
        ball.id === candidate.ownerId ||
        (ball.ownerId !== null && ball.ownerId === candidate.ownerId)
      ) {
        return nearest;
      }

      if (!nearest) return candidate;
      return Math.hypot(candidate.x - ball.x, candidate.y - ball.y) <
        Math.hypot(nearest.x - ball.x, nearest.y - ball.y)
        ? candidate
        : nearest;
    }, null);

    if (nearestOpponent) {
      // Lead the nearest moving opponent according to the beam's travel time.
      const targetDistance = Math.hypot(nearestOpponent.x - ball.x, nearestOpponent.y - ball.y);
      const leadTime = Math.min(targetDistance / BEAM_SPEED, 0.8);
      const predictedX = nearestOpponent.x + nearestOpponent.vx * leadTime;
      const predictedY = nearestOpponent.y + nearestOpponent.vy * leadTime;
      ball.gokuBeamAngle = Math.atan2(predictedY - ball.y, predictedX - ball.x);
    } else {
      ball.gokuBeamAngle = ball.facingAngle;
    }

    ball.gokuRage = 0;

    soundFX.playBlazeDash();
    vfx.triggerScreenShake(5 + rageRatio * 8);
    vfx.addFloatingText(ball.x, ball.y - ball.radius - 12, `🐉 KAMEHAMEHA! -${damage}`, '#60a5fa', 20);
    vfx.emitShockwaveRing(ball.x, ball.y, '#60a5fa', 70, 0.4);
    vfx.emitSparks(ball.x, ball.y, '#facc15', 18 + Math.round(rageRatio * 28), 240);

    const directionX = Math.cos(ball.gokuBeamAngle);
    const directionY = Math.sin(ball.gokuBeamAngle);
    for (const enemy of allBalls) {
      if (enemy.id === ball.id || enemy.isDead || enemy.isMinion) continue;

      const dx = enemy.x - ball.x;
      const dy = enemy.y - ball.y;
      const alongBeam = dx * directionX + dy * directionY;
      const acrossBeam = Math.abs(dx * directionY - dy * directionX);
      if (alongBeam < 0 || alongBeam > BEAM_LENGTH || acrossBeam > enemy.radius + BEAM_WIDTH) continue;

      enemy.takeDamage(damage, ball, vfx, true);
      vfx.emitSparks(enemy.x, enemy.y, '#60a5fa', 12, 190);
    }
  }

  public onActiveTick(ball: Ball, _dt: number, _allBalls: Ball[], vfx: ParticleSystem): void {
    if (Math.random() < 0.55) {
      vfx.emitSparks(ball.x, ball.y, '#60a5fa', 2, 110);
    }
  }

  public renderOverlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    if (ball.isSkillActive) {
      const beamStart = ball.radius + 4;
      const beamEnd = BEAM_LENGTH;
      const startX = ball.x + Math.cos(ball.gokuBeamAngle) * beamStart;
      const startY = ball.y + Math.sin(ball.gokuBeamAngle) * beamStart;
      const endX = ball.x + Math.cos(ball.gokuBeamAngle) * beamEnd;
      const endY = ball.y + Math.sin(ball.gokuBeamAngle) * beamEnd;
      const pulse = 1 + Math.sin(Date.now() * 0.04) * 0.18;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
      ctx.lineWidth = 52 * pulse;
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 24;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = '#bfdbfe';
      ctx.lineWidth = 18 * pulse;
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();
    }

    if (!ball.isSkillActive && ball.gokuRage <= 0) return;

    const ratio = ball.gokuRage / MAX_RAGE;
    const pulse = 1 + Math.sin(Date.now() * 0.012) * 0.06;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius + 5 + ratio * 8, 0, Math.PI * 2);
    ctx.strokeStyle = ball.isSkillActive ? '#60a5fa' : `rgba(250, 204, 21, ${0.25 + ratio * 0.7})`;
    ctx.lineWidth = 2 + ratio * 3;
    ctx.shadowColor = ball.isSkillActive ? '#60a5fa' : '#facc15';
    ctx.shadowBlur = (6 + ratio * 18) * pulse;
    ctx.stroke();
    ctx.restore();
  }
}