import type { BallTypeId } from '../types';

export interface RosterBallState {
  heroId: BallTypeId;
  isDead: boolean;
  currentHp: number;
  maxHp: number;
}

export type NetworkMessage =
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number }
  | { type: 'PEER_HELLO'; role: 'HOST' | 'GUEST'; p1Name?: string; p2Name?: string }
  | { type: 'DRAFT_PICK'; playerIdx: 1 | 2; heroId: BallTypeId; turnIndex: number }
  | { type: 'DRAFT_SYNC'; p1Draft: BallTypeId[]; p2Draft: BallTypeId[]; currentTurn: 1 | 2; turnIndex: number }
  | { type: 'SELECT_ROUND_HERO'; playerIdx: 1 | 2; heroId: BallTypeId }
  | { type: 'ROUND_START_PREP'; roundNumber: number; p1HeroId: BallTypeId; p2HeroId: BallTypeId; p1InitialHp: number; p2InitialHp: number }
  | { type: 'PLAYER_READY'; playerIdx: 1 | 2; aimAngle: number }
  | { type: 'START_COUNTDOWN'; p1Angle: number; p2Angle: number }
  | { type: 'LAUNCH_BATTLE'; p1Angle: number; p2Angle: number }
  | {
      type: 'COMBAT_SNAPSHOT';
      seq: number;
      boxAngle: number;
      p1: {
        x: number;
        y: number;
        nx?: number;
        ny?: number;
        vx: number;
        vy: number;
        nvx?: number;
        nvy?: number;
        hp: number;
        maxHp: number;
        facingAngle: number;
        isSkillActive: boolean;
        cooldownTimer: number;
        isDead: boolean;
        damageDealt: number;
        bounces: number;
      };
      p2: {
        x: number;
        y: number;
        nx?: number;
        ny?: number;
        vx: number;
        vy: number;
        nvx?: number;
        nvy?: number;
        hp: number;
        maxHp: number;
        facingAngle: number;
        isSkillActive: boolean;
        cooldownTimer: number;
        isDead: boolean;
        damageDealt: number;
        bounces: number;
      };
      events?: Array<{
        type: 'HIT' | 'WALL' | 'SKILL' | 'VFX';
        x: number;
        y: number;
        color?: string;
        text?: string;
      }>;
    }
  | {
      type: 'ROUND_RESULT';
      roundNumber: number;
      winnerPlayerIdx: 1 | 2 | null;
      survivingHeroId: BallTypeId | null;
      remainingHp: number;
      p1Roster: RosterBallState[];
      p2Roster: RosterBallState[];
    }
  | {
      type: 'MATCH_OVER';
      winnerPlayerIdx: 1 | 2;
      p1Roster: RosterBallState[];
      p2Roster: RosterBallState[];
    }
  | { type: 'REMATCH_REQUEST'; fromPlayerIdx: 1 | 2 }
  | { type: 'REMATCH_START' };
