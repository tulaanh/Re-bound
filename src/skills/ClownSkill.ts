import type { SkillStrategy } from './SkillStrategy';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

const BLAST_RADIUS = 180;
const DAMAGE_PER_MARK = 8;
const MARK_DAMAGE_EXPONENT = 1.5;
const LIFesteal_RATE = 0.6;

export class ClownSkill implements SkillStrategy {
  public readonly typeId = 'CLOWN';

  public activate(ball: Ball, allBalls: Ball[], vfx: ParticleSystem): void {
    soundFX.playBlazeDash();
    let markCount = 0;

    for (const target of allBalls) {
      if (
        target.id === ball.id ||
        target.isDead ||
        target.id === ball.ownerId ||
        ball.id === target.ownerId ||
        (ball.ownerId !== null && ball.ownerId === target.ownerId) ||
        Math.hypot(target.x - ball.x, target.y - ball.y) > BLAST_RADIUS + target.radius
      ) {
        continue;
      }

      const marks = target.clownMarks;
      if (marks <= 0) continue;

      markCount += marks;
      target.clownMarks = 0;
      target.clownMarkTimer = 0;

      const damage = Math.round(DAMAGE_PER_MARK * marks ** MARK_DAMAGE_EXPONENT);
      const hpBefore = target.hp;
      target.takeDamage(damage, ball, vfx, true);
      const actualDamage = Math.max(0, hpBefore - target.hp);

      if (marks > 3 && actualDamage > 0) {
        ball.heal(actualDamage * LIFesteal_RATE, vfx, false);
      }

      vfx.emitSparks(target.x, target.y, '#f472b6', 10 + marks * 3, 190);
      vfx.emitShockwaveRing(target.x, target.y, '#f472b6', 55 + marks * 8, 0.35);
      vfx.addFloatingText(target.x, target.y - target.radius - 12, `🤡 -${Math.round(actualDamage)}`, '#f9a8d4', 17);
    }

    if (markCount > 0) {
      vfx.triggerScreenShake(3 + markCount);
      vfx.addFloatingText(ball.x, ball.y - ball.radius - 12, `🎭 GIẢI PHÓNG ${markCount} ẤN!`, '#f472b6', 18);
    } else {
      vfx.addFloatingText(ball.x, ball.y - ball.radius - 12, '🎭 CHƯA CÓ ẤN ĐỂ NỔ!', '#f9a8d4', 15);
    }

    vfx.emitShockwaveRing(ball.x, ball.y, '#f472b6', BLAST_RADIUS, 0.45);
  }

  public renderOverlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    if (!ball.isSkillActive) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BLAST_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }
}