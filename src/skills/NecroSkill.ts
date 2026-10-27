import type { SkillStrategy } from './SkillStrategy';
import { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';

export class NecroSkill implements SkillStrategy {
  public readonly typeId = 'NECRO';

  public activate(ball: Ball, _allBalls: Ball[], vfx: ParticleSystem): void {
    if (ball.isMinion) return; // Minions cannot summon

    soundFX.playNecroSummon();
    vfx.triggerScreenShake(5);
    vfx.addFloatingText(ball.x, ball.y, '💀 LÍNH XƯƠNG!', '#a855f7', 18);
    vfx.emitShockwaveRing(ball.x, ball.y, '#a855f7', 85, 0.45);
    vfx.emitSparks(ball.x, ball.y, '#c084fc', 25, 200);

    // Summon 3 skeleton minions evenly around the summoner
    const angles = [ball.facingAngle, ball.facingAngle + (Math.PI * 2) / 3, ball.facingAngle - (Math.PI * 2) / 3];

    for (const angle of angles) {
      const spawnDist = ball.radius + 15;
      const sx = ball.x + Math.cos(angle) * spawnDist;
      const sy = ball.y + Math.sin(angle) * spawnDist;
      const initialSpeed = 190;
      const vx = Math.cos(angle) * initialSpeed;
      const vy = Math.sin(angle) * initialSpeed;

      const minion = new Ball('NECRO', sx, sy, vx, vy);
      minion.isMinion = true;
      minion.ownerId = ball.id;
      minion.radius = 13;
      minion.mass = (13 * 13) / 400;
      minion.maxHp = 35;
      minion.hp = 35;
      minion.baseAttack = 6;
      minion.targetSpeed = 160;

      // Custom Skeleton Appearance
      minion.skin = {
        name: 'Skeleton Minion',
        vietnameseName: 'Lính Xương',
        icon: '💀',
        primaryColor: '#e2e8f0', // bone white
        secondaryColor: '#94a3b8',
        glowColor: '#a855f7', // necrotic purple glow
        coreColor: '#ffffff',
        trailColor: 'rgba(168, 85, 247, 0.35)',
        description: 'Lính xương ma quái truy kích kẻ địch',
      };

      // Summoning portal effect
      vfx.emitShockwaveRing(sx, sy, '#a855f7', 35, 0.3);
      vfx.emitSparks(sx, sy, '#e2e8f0', 10, 120);

      ball.onSpawnMinion?.(minion);
    }
  }

  public renderOverlay(ball: Ball, ctx: CanvasRenderingContext2D): void {
    if (ball.isMinion) return;

    // Summoner aura: orbiting mystical soul wisps when skill is active
    if (ball.isSkillActive) {
      ctx.save();
      const t = Date.now() * 0.005;
      for (let i = 0; i < 3; i++) {
        const wispAngle = t + (i * Math.PI * 2) / 3;
        const wx = ball.x + Math.cos(wispAngle) * (ball.radius + 10);
        const wy = ball.y + Math.sin(wispAngle) * (ball.radius + 10);
        ctx.beginPath();
        ctx.arc(wx, wy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
