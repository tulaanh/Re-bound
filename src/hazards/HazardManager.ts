import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../vfx/ParticleSystem';
import { soundFX } from '../audio/SoundFX';
import type { FrostZone, ToxicPool, LightningHazard, MeteorImpact } from '../types';

export class HazardManager {
  public frostZones: FrostZone[] = [];
  public toxicPools: ToxicPool[] = [];
  public lightningHazards: LightningHazard[] = [];
  public meteorImpacts: MeteorImpact[] = [];
  private toxicTickAccumulator: number = 0;

  public clear(): void {
    this.frostZones = [];
    this.toxicPools = [];
    this.lightningHazards = [];
    this.meteorImpacts = [];
    this.toxicTickAccumulator = 0;
  }

  public disintegrateInArea(
    x: number,
    y: number,
    radius: number,
    vfx: ParticleSystem
  ): number {
    let count = 0;

    // 1. Frost Zones
    for (let i = this.frostZones.length - 1; i >= 0; i--) {
      const z = this.frostZones[i];
      if (Math.hypot(z.x - x, z.y - y) <= radius + z.radius * 0.4) {
        vfx.emitSparks(z.x, z.y, '#a855f7', 12, 140);
        vfx.emitShockwaveRing(z.x, z.y, '#c084fc', 35, 0.3);
        this.frostZones.splice(i, 1);
        count++;
      }
    }

    // 2. Toxic Pools
    for (let i = this.toxicPools.length - 1; i >= 0; i--) {
      const p = this.toxicPools[i];
      if (Math.hypot(p.x - x, p.y - y) <= radius + p.radius * 0.4) {
        vfx.emitSparks(p.x, p.y, '#a855f7', 10, 130);
        vfx.emitShockwaveRing(p.x, p.y, '#c084fc', 30, 0.25);
        this.toxicPools.splice(i, 1);
        count++;
      }
    }

    // 3. Lightning Hazards
    for (let i = this.lightningHazards.length - 1; i >= 0; i--) {
      const hz = this.lightningHazards[i];
      const anyInArea = hz.points.some(
        (pt) => Math.hypot(pt.x - x, pt.y - y) <= radius
      );
      if (anyInArea) {
        for (const pt of hz.points) {
          vfx.emitSparks(pt.x, pt.y, '#a855f7', 4, 80);
        }
        this.lightningHazards.splice(i, 1);
        count++;
      }
    }

    // 4. Meteor Impacts
    for (let i = this.meteorImpacts.length - 1; i >= 0; i--) {
      const imp = this.meteorImpacts[i];
      if (Math.hypot(imp.x - x, imp.y - y) <= radius + imp.radius * 0.4) {
        vfx.emitSparks(imp.x, imp.y, '#a855f7', 10, 120);
        this.meteorImpacts.splice(i, 1);
        count++;
      }
    }

    return count;
  }

  public onBoxResize(
    oldCenterX: number,
    oldCenterY: number,
    oldSize: number,
    newCenterX: number,
    newCenterY: number,
    newSize: number
  ): void {
    const scaleFactor = newSize / oldSize;
    for (const z of this.frostZones) {
      z.x = newCenterX + (z.x - oldCenterX) * scaleFactor;
      z.y = newCenterY + (z.y - oldCenterY) * scaleFactor;
      z.radius *= scaleFactor;
    }
    for (const p of this.toxicPools) {
      p.x = newCenterX + (p.x - oldCenterX) * scaleFactor;
      p.y = newCenterY + (p.y - oldCenterY) * scaleFactor;
      p.radius *= scaleFactor;
    }
    for (const hz of this.lightningHazards) {
      for (const pt of hz.points) {
        pt.x = newCenterX + (pt.x - oldCenterX) * scaleFactor;
        pt.y = newCenterY + (pt.y - oldCenterY) * scaleFactor;
      }
    }
    for (const impact of this.meteorImpacts) {
      impact.x = newCenterX + (impact.x - oldCenterX) * scaleFactor;
      impact.y = newCenterY + (impact.y - oldCenterY) * scaleFactor;
      impact.radius *= scaleFactor;
    }
  }

  public createFrostZone(
    ownerId: string,
    x: number,
    y: number,
    radius: number = 90,
    duration: number = 5
  ): void {
    // Relocate zone if this owner already cast one
    this.frostZones = this.frostZones.filter((z) => z.ownerId !== ownerId);
    this.frostZones.push({
      id: Math.random().toString(36).substring(2, 9),
      ownerId,
      x,
      y,
      radius,
      duration,
      maxDuration: duration,
      tickTimer: 0,
      rotationAngle: 0,
    });
  }

  public createToxicPools(
    ownerId: string,
    pools: { x: number; y: number; radius: number; duration: number }[],
    boxSize: number,
    boxCenterX: number,
    boxCenterY: number,
    vfx: ParticleSystem
  ): void {
    // 1. Clear previous pools of this owner to prevent clutter/overlapping
    this.toxicPools = this.toxicPools.filter((p) => p.ownerId !== ownerId);

    const maxDist = boxSize * 0.42;
    const preparedPools = pools.map((p) => {
      // Clamp pool within arena box
      const dx = p.x - boxCenterX;
      const dy = p.y - boxCenterY;
      const d = Math.sqrt(dx * dx + dy * dy);
      let px = p.x;
      let py = p.y;
      if (d > maxDist && d > 0.001) {
        px = boxCenterX + (dx / d) * maxDist;
        py = boxCenterY + (dy / d) * maxDist;
      }
      return { ...p, x: px, y: py };
    });

    // 2. Separation relaxation pass to strictly enforce NO overlap between pools
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < preparedPools.length; i++) {
        for (let j = i + 1; j < preparedPools.length; j++) {
          const p1 = preparedPools[i];
          const p2 = preparedPools[j];
          let dx = p2.x - p1.x;
          let dy = p2.y - p1.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = p1.radius + p2.radius + 8; // 8px guaranteed gap between puddles
          if (dist < minDist) {
            if (dist < 0.001) {
              dx = 1;
              dy = 0;
              dist = 1;
            }
            const push = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            p1.x -= nx * push;
            p1.y -= ny * push;
            p2.x += nx * push;
            p2.y += ny * push;
          }
        }
      }
    }

    for (const p of preparedPools) {
      this.toxicPools.push({
        id: Math.random().toString(36).substring(2, 9),
        ownerId,
        x: p.x,
        y: p.y,
        radius: p.radius,
        duration: p.duration,
        maxDuration: p.duration,
      });

      vfx.emitSparks(p.x, p.y, '#34d399', 8, 140);
    }
  }

  public createLightningHazard(
    ownerId: string,
    points: { x: number; y: number }[],
    duration: number = 1.5
  ): void {
    if (points.length < 2) return;
    this.lightningHazards.push({
      id: Math.random().toString(36).substring(2, 9),
      ownerId,
      points: [...points],
      duration,
      maxDuration: duration,
      isEmitting: false,
      emitTimer: 0,
    });
  }

  public createMeteorShower(
    owner: Ball,
    boxSize: number,
    boxCenterX: number,
    boxCenterY: number,
    boxAngle: number
  ): void {
    const impactRadius = 70;
    const hpRatio = owner.hp / owner.maxHp;
    const meteorCount = hpRatio <= 0.05 ? 5 : hpRatio <= 0.3 ? 4 : 3;
    const halfExtent = Math.max(0, boxSize * 0.5 - impactRadius - 12);
    const cos = Math.cos(boxAngle);
    const sin = Math.sin(boxAngle);
    const chosenLocalPositions: { x: number; y: number }[] = [];

    for (let i = 0; i < meteorCount; i++) {
      // Pick and reserve the landing point first. Keep points spread apart so
      // one barrage covers more of the arena instead of stacking impacts.
      let localX = 0;
      let localY = 0;
      for (let attempt = 0; attempt < 16; attempt++) {
        localX = (Math.random() * 2 - 1) * halfExtent;
        localY = (Math.random() * 2 - 1) * halfExtent;
        if (chosenLocalPositions.every((point) => Math.hypot(point.x - localX, point.y - localY) >= impactRadius * 1.8)) {
          break;
        }
      }
      chosenLocalPositions.push({ x: localX, y: localY });

      const x = boxCenterX + localX * cos - localY * sin;
      const y = boxCenterY + localX * sin + localY * cos;
      this.meteorImpacts.push({
        id: Math.random().toString(36).substring(2, 9),
        ownerId: owner.id,
        x,
        y,
        radius: impactRadius,
        warningTimer: 0.9,
        fallTimer: 0.4,
      });
    }
  }

  public update(dt: number, balls: Ball[], vfx: ParticleSystem): void {
    // 1. Update Frost Blizzard Zones
    for (const zone of this.frostZones) {
      zone.duration -= dt;
      zone.tickTimer += dt;
      zone.rotationAngle += 0.8 * dt;

      // Ambient snowflakes inside zone
      if (Math.random() < 0.35) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * zone.radius;
        vfx.emitTrail(zone.x + Math.cos(a) * d, zone.y + Math.sin(a) * d, '#bae6fd', 3);
      }

      // Periodic tick: DoT every 0.5s (3 HP = 6 HP/s) and Freeze check every 1.0s
      let doDamageTick = false;
      let doFreezeCheck = false;

      if (zone.tickTimer >= 0.5) {
        zone.tickTimer -= 0.5;
        doDamageTick = true;
        zone.secondTick = !zone.secondTick;
        if (zone.secondTick) {
          doFreezeCheck = true;
        }
      }

      for (const b of balls) {
        if (b.isDead || b.id === zone.ownerId) continue; // Immune to owner
        const dx = b.x - zone.x;
        const dy = b.y - zone.y;
        if (dx * dx + dy * dy <= (zone.radius + b.radius) * (zone.radius + b.radius)) {
          // Slow by 60%
          b.applyStatusEffect('FROZEN', 0.4);

          // Clear DoT damage (3 HP every 0.5s = 6 HP/s)
          if (doDamageTick) {
            b.takeDamage(3, null, vfx, true);
          }

          // 30% freeze probability per second for 0.7s
          if (doFreezeCheck && Math.random() < 0.3) {
            b.applyStatusEffect('FROZEN_SOLID', 0.7);
            b.vx = 0;
            b.vy = 0;
            vfx.addFloatingText(b.x, b.y, '❄️ ĐÓNG BĂNG 0.7s!', '#38bdf8', 18);
            vfx.emitSparks(b.x, b.y, '#bae6fd', 14, 180);
            soundFX.playFrostNova();
          }
        }
      }
    }
    this.frostZones = this.frostZones.filter((z) => z.duration > 0);

    // 2. Update Toxic Acid Pools (4.0s Duration, 7 HP/s, Lingering 4s Poison)
    for (const pool of this.toxicPools) {
      pool.duration -= dt;
      if (Math.random() < 0.22) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * pool.radius * 0.8;
        vfx.emitTrail(pool.x + Math.cos(a) * d, pool.y + Math.sin(a) * d, '#34d399', 2.5);
      }
    }
    this.toxicPools = this.toxicPools.filter((p) => p.duration > 0);

    // 3. Meteor impacts: give a short warning, then deal heavy area damage.
    for (let i = this.meteorImpacts.length - 1; i >= 0; i--) {
      const impact = this.meteorImpacts[i];
      if (impact.warningTimer > 0) {
        impact.warningTimer = Math.max(0, impact.warningTimer - dt);
        continue;
      }

      impact.fallTimer -= dt;
      if (impact.fallTimer > 0) continue;

      const owner = balls.find((b) => b.id === impact.ownerId) || null;
      vfx.triggerScreenShake(7);
      vfx.emitShockwaveRing(impact.x, impact.y, '#fb923c', impact.radius * 2.2, 0.4);
      vfx.emitSparks(impact.x, impact.y, '#fb923c', 26, 250);
      vfx.emitSparks(impact.x, impact.y, '#fef3c7', 14, 180);

      for (const victim of balls) {
        if (victim.isDead || victim.id === impact.ownerId) continue;
        if (Math.hypot(victim.x - impact.x, victim.y - impact.y) <= impact.radius + victim.radius) {
          victim.takeDamage(60, owner, vfx, true);
          const dx = victim.x - impact.x;
          const dy = victim.y - impact.y;
          const distance = Math.hypot(dx, dy) || 1;
          victim.vx = (dx / distance) * 270;
          victim.vy = (dy / distance) * 270;
        }
      }
      this.meteorImpacts.splice(i, 1);
    }

    // Periodic Damage Tick in Pool every 0.5s: 3.5 HP (7 HP/s)
    this.toxicTickAccumulator += dt;
    let doToxicTick = false;
    if (this.toxicTickAccumulator >= 0.5) {
      this.toxicTickAccumulator -= 0.5;
      doToxicTick = true;
    }

    if (this.toxicPools.length > 0) {
      for (const b of balls) {
        if (b.isDead) continue;
        let insidePool = false;
        let poolOwner: Ball | null = null;

        for (const pool of this.toxicPools) {
          if (b.id === pool.ownerId) continue; // Owner is immune!
          const dx = b.x - pool.x;
          const dy = b.y - pool.y;
          if (dx * dx + dy * dy <= (pool.radius + b.radius) * (pool.radius + b.radius)) {
            insidePool = true;
            if (!poolOwner) {
              poolOwner = balls.find((o) => o.id === pool.ownerId) || null;
            }
            break; // No damage stacking across multiple overlapping pools
          }
        }

        if (insidePool) {
          // Continuously refresh 4.0s lingering poison
          b.applyStatusEffect('POISONED', 4.0);
          if (doToxicTick) {
            b.takeDamage(3.5, poolOwner, vfx, true);
            vfx.emitSparks(b.x, b.y, '#34d399', 3, 60);
          }
        }
      }
    }

    // 4. Update Lightning Hazards (1.0s Duration, Electrified Debuff)
    for (const hz of this.lightningHazards) {
      hz.duration -= dt;
      if (Math.random() < 0.4 && hz.points.length >= 2) {
        const segIdx = Math.floor(Math.random() * (hz.points.length - 1));
        const p1 = hz.points[segIdx];
        const p2 = hz.points[segIdx + 1];
        const t = Math.random();
        vfx.emitSparks(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t, '#fde047', 2, 80);
      }
    }
    this.lightningHazards = this.lightningHazards.filter((hz) => hz.duration > 0);

    // Collision check with lightning hazards & active emitting trails
    for (const b of balls) {
      if (b.isDead || b.voltHitCooldown > 0) continue;

      let hitByVolt = false;
      let owner: Ball | null = null;

      // A. Check against persistent hazards
      for (const hz of this.lightningHazards) {
        if (b.id === hz.ownerId) continue; // Owner is immune
        if (hz.points.length < 2) continue;

        for (let i = 0; i < hz.points.length - 1; i++) {
          const p1 = hz.points[i];
          const p2 = hz.points[i + 1];
          if (this.distToSegment(b.x, b.y, p1.x, p1.y, p2.x, p2.y) <= b.radius + 8) {
            hitByVolt = true;
            owner = balls.find((o) => o.id === hz.ownerId) || null;
            break;
          }
        }
        if (hitByVolt) break;
      }

      // B. Check against currently emitting trails of live Volt balls
      if (!hitByVolt) {
        for (const voltBall of balls) {
          if (voltBall.isDead || !voltBall.isSkillActive || voltBall.typeId !== 'VOLT') continue;
          if (voltBall.id === b.id) continue;
          const pts = voltBall.voltEmittingPoints;
          if (pts.length < 2) continue;

          for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            if (this.distToSegment(b.x, b.y, p1.x, p1.y, p2.x, p2.y) <= b.radius + 8) {
              hitByVolt = true;
              owner = voltBall;
              break;
            }
          }
          if (hitByVolt) break;
        }
      }

      if (hitByVolt) {
        this.triggerLightningExplosion(b, owner, vfx);
      }
    }
  }

  private triggerLightningExplosion(victim: Ball, voltOwner: Ball | null, vfx: ParticleSystem): void {
    if (victim.isDead || victim.voltHitCooldown > 0) return;
    victim.voltHitCooldown = 0.5;

    const hasMark = victim.hasStatusEffect('ELECTRIFIED');
    if (!hasMark) {
      // 1. First hit without mark: 10 HP damage + apply Electrified Mark 2.5s
      victim.takeDamage(10, voltOwner, vfx, true);
      victim.applyStatusEffect('ELECTRIFIED', 2.5);
      vfx.addFloatingText(victim.x, victim.y, '⚡ NHIỄM ĐIỆN (-10)!', '#fde047', 16);
      vfx.emitSparks(victim.x, victim.y, '#fde047', 12, 160);
      soundFX.playVoltZap();
    } else {
      // 2. Hit with existing mark: Consume mark and trigger x3 Overload Explosion (30 HP)
      victim.removeStatusEffect('ELECTRIFIED');
      victim.takeDamage(30, voltOwner, vfx, true);
      vfx.addFloatingText(victim.x, victim.y, '💥⚡ -30 NỔ QUÁ TẢI!', '#fde047', 20);
      vfx.emitSparks(victim.x, victim.y, '#fde047', 22, 220);
      vfx.emitSparks(victim.x, victim.y, '#ffffff', 10, 160);
      soundFX.playVoltZap();
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

  public render(ctx: CanvasRenderingContext2D, balls: Ball[]): void {
    this.renderMeteorImpacts(ctx);
    this.renderFrostZones(ctx);
    this.renderToxicPools(ctx);
    this.renderLightningHazards(ctx, balls);
  }

  private renderFrostZones(ctx: CanvasRenderingContext2D): void {
    for (const zone of this.frostZones) {
      ctx.save();

      // 1. Translucent icy ground disc
      const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.radius);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.32)');
      grad.addColorStop(0.7, 'rgba(14, 165, 233, 0.18)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Pulsing outer frost boundary ring
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.03;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Rotating snowflake runes around perimeter
      ctx.shadowBlur = 0;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) {
        const angle = zone.rotationAngle + (i * Math.PI) / 2;
        const sx = zone.x + Math.cos(angle) * (zone.radius * 0.85);
        const sy = zone.y + Math.sin(angle) * (zone.radius * 0.85);
        ctx.fillText('❄️', sx, sy);
      }

      // 4. Timer tag at center
      const secLeft = Math.ceil(zone.duration);
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillStyle = '#bae6fd';
      ctx.fillText(`❄️ ${secLeft}s`, zone.x, zone.y);

      ctx.restore();
    }
  }

  private renderToxicPools(ctx: CanvasRenderingContext2D): void {
    for (const pool of this.toxicPools) {
      ctx.save();

      // 1. Slime puddle radial gradient
      const grad = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pool.radius);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
      grad.addColorStop(0.7, 'rgba(5, 150, 105, 0.28)');
      grad.addColorStop(1, 'rgba(4, 120, 87, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Pulsing neon green border
      const pulse = 1 + Math.sin(Date.now() * 0.008 + pool.x) * 0.05;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Bubbling acid droplets inside
      ctx.shadowBlur = 0;
      const t = Date.now() * 0.003;
      for (let i = 0; i < 3; i++) {
        const bubbleAngle = (i * Math.PI * 2) / 3 + t;
        const bubbleDist = pool.radius * 0.5 * (0.6 + 0.4 * Math.sin(t * 1.5 + i));
        const bx = pool.x + Math.cos(bubbleAngle) * bubbleDist;
        const by = pool.y + Math.sin(bubbleAngle) * bubbleDist;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(167, 243, 208, 0.7)';
        ctx.fill();
      }

      // 4. Timer tag
      const secLeft = Math.ceil(pool.duration);
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(`🧪 ${secLeft}s`, pool.x, pool.y);

      ctx.restore();
    }
  }

  private renderLightningHazards(ctx: CanvasRenderingContext2D, balls: Ball[]): void {
    // 1. Render persistent hazards
    for (const hz of this.lightningHazards) {
      if (hz.points.length < 2) continue;
      this.drawElectricPolyline(ctx, hz.points, Math.min(1, hz.duration / 0.25));
    }

    // 2. Render live emitting trails of active Volt balls
    for (const b of balls) {
      if (!b.isDead && b.isSkillActive && b.typeId === 'VOLT' && b.voltEmittingPoints.length >= 2) {
        // Connect points up to the ball's live coordinates
        const livePts = [...b.voltEmittingPoints, { x: b.x, y: b.y }];
        this.drawElectricPolyline(ctx, livePts, 1.0, true);
      }
    }
  }

  private renderMeteorImpacts(ctx: CanvasRenderingContext2D): void {
    for (const impact of this.meteorImpacts) {
      ctx.save();
      if (impact.warningTimer > 0) {
        const progress = 1 - impact.warningTimer / 0.9;
        const pulse = 1 + Math.sin(Date.now() * 0.025) * 0.08;
        ctx.globalAlpha = 0.55 + progress * 0.4;
        ctx.beginPath();
        ctx.arc(impact.x, impact.y, impact.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff7ed';
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☄', impact.x, impact.y);
      } else {
        const progress = Math.max(0, Math.min(1, 1 - impact.fallTimer / 0.4));
        const meteorX = impact.x - 55 * (1 - progress);
        const meteorY = impact.y - 220 * (1 - progress);
        ctx.globalAlpha = 1;

        // Bright trail makes the falling direction and selected landing point clear.
        ctx.beginPath();
        ctx.moveTo(meteorX - 5, meteorY - 8);
        ctx.lineTo(meteorX + 34, meteorY + 58);
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.8)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 22;
        ctx.stroke();

        ctx.fillStyle = '#fff7ed';
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 18;
        ctx.fillText('☄', meteorX, meteorY);
      }
      ctx.restore();
    }
  }

  private drawElectricPolyline(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    alpha: number = 1.0,
    isEmitting: boolean = false
  ): void {
    if (points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Outer glow line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Crackling core bolt with slight high-voltage jitter
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      // Insert mid jitter point for dynamic lightning feel
      const midX = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 5;
      const midY = (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 5;
      ctx.lineTo(midX, midY);
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = isEmitting ? 3.5 : 2.5;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.stroke();

    // Electric node sparks at joints
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 6;
    for (let i = 0; i < points.length; i += 2) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
