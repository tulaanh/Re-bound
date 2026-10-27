export type GameMode = 'BATTLE' | 'SANDBOX' | 'ONLINE_DUEL';

export type SandboxPhase = 'SELECTING_BALLS' | 'AIMING' | 'COUNTDOWN' | 'BATTLE';

export type OnlinePhase =
  | 'LOBBY'
  | 'DRAFT'
  | 'SELECT_ROUND_HERO'
  | 'AIMING'
  | 'COUNTDOWN'
  | 'BATTLE'
  | 'ROUND_OVER'
  | 'MATCH_OVER';

export type BallTypeId = 'BLAZE' | 'FROST' | 'VOLT' | 'VOID' | 'TOXIC' | 'VAMPIRE' | 'METEOR' | 'AXE' | 'NECRO' | 'SLIME' | 'GOKU' | 'CLOWN' | 'TITAN' | 'WOOD' | 'DAGGER' | 'SPIDER';

export interface Vector2D {
  x: number;
  y: number;
}

export interface BallSkinConfig {
  name: string;
  vietnameseName: string;
  icon: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  coreColor: string;
  trailColor: string;
  description: string;
}

export interface BallSkillConfig {
  name: string;
  vietnameseName: string;
  description: string;
  cooldown: number; // in seconds
  duration: number; // duration of active state in seconds
}

export interface BallStats {
  maxHp: number;
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  kills: number;
  bounces: number;
}

export type StatusEffectType =
  | 'FROZEN'
  | 'BURNING'
  | 'FROZEN_SOLID'
  | 'POISONED'
  | 'ELECTRIFIED'
  | 'BLEEDING';

export interface StatusEffect {
  type: StatusEffectType;
  duration: number; // remaining seconds
  intensity?: number;
  poisonTickTimer?: number;
  bleedTickTimer?: number;
}

export interface HeroExtraMeta {
  role: string;
  roleColor: string;
  tactics: string;
}

export interface LightningHazard {
  id: string;
  ownerId: string;
  points: { x: number; y: number }[];
  duration: number; // starts at 1.0s after emission finishes
  maxDuration: number;
  isEmitting: boolean;
  emitTimer: number; // 0.5s emitting duration
}

export interface ToxicPool {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  duration: number; // starts at 4.0s
  maxDuration: number;
}

export interface FrostZone {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  duration: number; // starts at 30s
  maxDuration: number;
  tickTimer: number; // accumulates for periodic damage & freeze check
  rotationAngle: number;
  secondTick?: boolean;
}

export interface MeteorImpact {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  warningTimer: number;
  fallTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  shape?: 'circle' | 'spark' | 'ring' | 'smoke' | 'lightning';
  ringRadius?: number;
  ringMaxRadius?: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
  life: number;
  maxLife: number;
  fontSize: number;
}

export interface AimConfig {
  angle: number; // In radians
  power: number; // In px/s
  isReady: boolean;
}
