import { peerConnection } from './PeerConnection';
import type { NetworkMessage, RosterBallState } from './NetworkMessages';
import type { GameEngine } from '../core/GameEngine';
import type { BallTypeId, OnlinePhase } from '../types';
import { BALL_CONFIGS } from '../entities/BallTypes';
import { soundFX } from '../audio/SoundFX';

export class OnlineGameManager {
  public engine: GameEngine;
  public onlinePhase: OnlinePhase = 'LOBBY';
  public myPlayerIdx: 1 | 2 = 1;
  public opponentPlayerIdx: 1 | 2 = 2;

  // Draft state
  public draftPicks: { p1: BallTypeId[]; p2: BallTypeId[] } = { p1: [], p2: [] };
  public currentDraftTurn: 1 | 2 = 1;
  public draftTurnIndex: number = 0; // 0 to 5

  // Rosters (3 balls each)
  public p1Roster: RosterBallState[] = [];
  public p2Roster: RosterBallState[] = [];

  // Current Round state
  public currentRound: number = 1;
  public p1ActiveHero: BallTypeId | null = null;
  public p2ActiveHero: BallTypeId | null = null;
  public p1CurrentHp: number = 0;
  public p2CurrentHp: number = 0;

  // Aiming & Ready
  public myAimAngle: number = 0;
  public myReady: boolean = false;
  public opponentReady: boolean = false;
  public opponentRequestedRematch: boolean = false;
  public p1Angle: number = 0;
  public p2Angle: number = Math.PI;

  // Snapshot streaming (Host only)
  private snapshotTimer: number | null = null;
  private snapshotSeq: number = 0;

  // Callbacks for UI updates
  public onStateChanged?: () => void;
  public onChatMessage?: (text: string) => void;
  public onRoundEnded?: (winnerIdx: 1 | 2 | null, survivingHero: BallTypeId | null, remainingHp: number) => void;
  public onMatchEnded?: (winnerIdx: 1 | 2) => void;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.setupNetworkHandlers();
  }

  public get isHost(): boolean {
    return peerConnection.isHost;
  }

  public initAsHost(code: string) {
    this.myPlayerIdx = 1;
    this.opponentPlayerIdx = 2;
    this.onlinePhase = 'LOBBY';
    this.resetMatchData();
    this.engine.setGameMode('ONLINE_DUEL');
    this.myAimAngle = -0.15; // default angle for P1
    console.log(`[OnlineGameManager] Initialized as Host for room ${code}`);
    if (this.onStateChanged) this.onStateChanged();
  }

  public initAsGuest() {
    this.myPlayerIdx = 2;
    this.opponentPlayerIdx = 1;
    this.onlinePhase = 'LOBBY';
    this.resetMatchData();
    this.engine.setGameMode('ONLINE_DUEL');
    this.myAimAngle = Math.PI + 0.15; // default angle for P2
    if (this.onStateChanged) this.onStateChanged();
  }

  public resetMatchData() {
    this.draftPicks = { p1: [], p2: [] };
    this.currentDraftTurn = 1;
    this.draftTurnIndex = 0;
    this.p1Roster = [];
    this.p2Roster = [];
    this.currentRound = 1;
    this.p1ActiveHero = null;
    this.p2ActiveHero = null;
    this.p1CurrentHp = 0;
    this.p2CurrentHp = 0;
    this.myReady = false;
    this.opponentReady = false;
    this.opponentRequestedRematch = false;
    this.stopSnapshotStream();

    // Reset Engine state so previous match's winner or balls don't freeze the new match
    this.engine.winner = null;
    this.engine.isDraw = false;
    this.engine.matchEndHandled = false;
    this.engine.balls = [];
    this.engine.hazardManager.clear();
    this.engine.vfx.clear();
  }

  private setupNetworkHandlers() {
    peerConnection.onMessage((msg: NetworkMessage) => {
      this.handleNetworkMessage(msg);
    });

    peerConnection.onConnect(() => {
      console.log('[OnlineGameManager] Connected to opponent! isHost:', this.isHost);
      if (this.isHost) {
        // Host starts Draft Phase when Guest connects
        this.onlinePhase = 'DRAFT';
        this.currentDraftTurn = 1;
        this.draftTurnIndex = 0;
        this.draftPicks = { p1: [], p2: [] };
        peerConnection.send({
          type: 'DRAFT_SYNC',
          p1Draft: [],
          p2Draft: [],
          currentTurn: 1,
          turnIndex: 0,
        });
        if (this.onStateChanged) this.onStateChanged();
      } else {
        // Guest sends PEER_HELLO to trigger synchronization
        peerConnection.send({
          type: 'PEER_HELLO',
          role: 'GUEST',
        });
      }
    });

    peerConnection.onDisconnect((reason) => {
      console.warn('[OnlineGameManager] Disconnected:', reason);
      this.stopSnapshotStream();
      alert(`Mất kết nối: ${reason}`);
      this.onlinePhase = 'LOBBY';
      if (this.onStateChanged) this.onStateChanged();
    });
  }

  public handleNetworkMessage(msg: NetworkMessage) {
    switch (msg.type) {
      case 'PEER_HELLO': {
        console.log('[OnlineGameManager] Host received PEER_HELLO from Guest');
        if (this.isHost) {
          this.onlinePhase = 'DRAFT';
          peerConnection.send({
            type: 'DRAFT_SYNC',
            p1Draft: this.draftPicks.p1,
            p2Draft: this.draftPicks.p2,
            currentTurn: this.currentDraftTurn,
            turnIndex: this.draftTurnIndex,
          });
          if (this.onStateChanged) this.onStateChanged();
        }
        break;
      }

      case 'DRAFT_PICK': {
        this.applyDraftPick(msg.playerIdx, msg.heroId);
        break;
      }

      case 'DRAFT_SYNC': {
        this.onlinePhase = 'DRAFT';
        this.draftPicks.p1 = msg.p1Draft;
        this.draftPicks.p2 = msg.p2Draft;
        this.currentDraftTurn = msg.currentTurn;
        this.draftTurnIndex = msg.turnIndex;
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'SELECT_ROUND_HERO': {
        if (msg.playerIdx === 1) {
          this.p1ActiveHero = msg.heroId;
          const heroState = this.p1Roster.find((r) => r.heroId === msg.heroId);
          if (heroState) this.p1CurrentHp = heroState.currentHp;
        } else {
          this.p2ActiveHero = msg.heroId;
          const heroState = this.p2Roster.find((r) => r.heroId === msg.heroId);
          if (heroState) this.p2CurrentHp = heroState.currentHp;
        }
        this.checkBothHeroesSelected();
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'ROUND_START_PREP': {
        this.currentRound = msg.roundNumber;
        this.p1ActiveHero = msg.p1HeroId;
        this.p2ActiveHero = msg.p2HeroId;
        this.p1CurrentHp = msg.p1InitialHp;
        this.p2CurrentHp = msg.p2InitialHp;
        this.prepareRoundArena();
        break;
      }

      case 'PLAYER_READY': {
        if (msg.playerIdx === 1) {
          this.p1Angle = msg.aimAngle;
        } else {
          this.p2Angle = msg.aimAngle;
        }
        this.opponentReady = true;

        if (this.isHost) {
          if (this.myReady && this.opponentReady) {
            // Both ready! Start countdown
            this.startCountdown();
          }
        }
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'START_COUNTDOWN': {
        this.p1Angle = msg.p1Angle;
        this.p2Angle = msg.p2Angle;
        this.onlinePhase = 'COUNTDOWN';
        this.engine.startOnlineCountdown(msg.p1Angle, msg.p2Angle);
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'LAUNCH_BATTLE': {
        this.onlinePhase = 'BATTLE';
        this.engine.launchOnlineBattle(msg.p1Angle, msg.p2Angle);
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'COMBAT_SNAPSHOT': {
        if (!this.isHost) {
          if (this.onlinePhase !== 'BATTLE') {
            console.log('[OnlineGameManager] Auto-advancing Guest to BATTLE from received snapshot');
            this.onlinePhase = 'BATTLE';
            this.engine.countdownTimer = 0;
            if (this.engine.p1Ball) this.engine.p1Ball.isAiming = false;
            if (this.engine.p2Ball) this.engine.p2Ball.isAiming = false;
            if (this.onStateChanged) this.onStateChanged();
          }
          this.applyCombatSnapshot(msg);
        }
        break;
      }

      case 'ROUND_RESULT': {
        this.stopSnapshotStream();
        this.onlinePhase = 'ROUND_OVER';
        this.p1Roster = msg.p1Roster;
        this.p2Roster = msg.p2Roster;
        this.currentRound = msg.roundNumber + 1;

        if (msg.winnerPlayerIdx === 1) {
          this.p1ActiveHero = msg.survivingHeroId;
          this.p1CurrentHp = msg.remainingHp;
          this.p2ActiveHero = null;
          this.p2CurrentHp = 0;
        } else if (msg.winnerPlayerIdx === 2) {
          this.p2ActiveHero = msg.survivingHeroId;
          this.p2CurrentHp = msg.remainingHp;
          this.p1ActiveHero = null;
          this.p1CurrentHp = 0;
        } else {
          this.p1ActiveHero = null;
          this.p2ActiveHero = null;
          this.p1CurrentHp = 0;
          this.p2CurrentHp = 0;
        }

        if (this.onRoundEnded) {
          this.onRoundEnded(msg.winnerPlayerIdx, msg.survivingHeroId, msg.remainingHp);
        }
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'MATCH_OVER': {
        this.stopSnapshotStream();
        this.onlinePhase = 'MATCH_OVER';
        this.p1Roster = msg.p1Roster;
        this.p2Roster = msg.p2Roster;
        if (this.onMatchEnded) {
          this.onMatchEnded(msg.winnerPlayerIdx);
        }
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'REMATCH_REQUEST': {
        this.opponentRequestedRematch = true;
        soundFX.playAimTick();
        if (this.onStateChanged) this.onStateChanged();
        break;
      }

      case 'REMATCH_START': {
        this.resetMatchData();
        this.onlinePhase = 'DRAFT';
        if (this.onStateChanged) this.onStateChanged();
        break;
      }
    }
  }

  // ==========================================
  // DRAFT PICK LOGIC
  // ==========================================

  public selectDraftHero(heroId: BallTypeId) {
    if (this.onlinePhase !== 'DRAFT') return;
    if (this.currentDraftTurn !== this.myPlayerIdx) return;

    // Check if hero already chosen by anyone
    if (this.draftPicks.p1.includes(heroId) || this.draftPicks.p2.includes(heroId)) {
      return;
    }

    // Apply locally and send to peer
    peerConnection.send({
      type: 'DRAFT_PICK',
      playerIdx: this.myPlayerIdx,
      heroId,
      turnIndex: this.draftTurnIndex,
    });
    this.applyDraftPick(this.myPlayerIdx, heroId);
  }

  private applyDraftPick(playerIdx: 1 | 2, heroId: BallTypeId) {
    if (playerIdx === 1) {
      this.draftPicks.p1.push(heroId);
    } else {
      this.draftPicks.p2.push(heroId);
    }

    soundFX.playWallBounce(1.8);
    this.draftTurnIndex++;

    // Alternating turns: P1 -> P2 -> P1 -> P2 -> P1 -> P2 (total 6 picks)
    if (this.draftTurnIndex < 6) {
      this.currentDraftTurn = this.currentDraftTurn === 1 ? 2 : 1;
    } else {
      // Draft completed! Initialize rosters
      this.finalizeDraft();
    }

    if (this.onStateChanged) this.onStateChanged();
  }

  private finalizeDraft() {
    this.p1Roster = this.draftPicks.p1.map((id) => ({
      heroId: id,
      isDead: false,
      currentHp: BALL_CONFIGS[id].baseHp,
      maxHp: BALL_CONFIGS[id].baseHp,
    }));

    this.p2Roster = this.draftPicks.p2.map((id) => ({
      heroId: id,
      isDead: false,
      currentHp: BALL_CONFIGS[id].baseHp,
      maxHp: BALL_CONFIGS[id].baseHp,
    }));

    this.currentRound = 1;
    this.onlinePhase = 'SELECT_ROUND_HERO';
    this.p1ActiveHero = null;
    this.p2ActiveHero = null;
  }

  // ==========================================
  // HERO SELECTION FOR ROUND (Vanguard / Counter-pick)
  // ==========================================

  public selectHeroForRound(heroId: BallTypeId) {
    if (this.onlinePhase !== 'SELECT_ROUND_HERO') return;

    const roster = this.myPlayerIdx === 1 ? this.p1Roster : this.p2Roster;
    const heroState = roster.find((r) => r.heroId === heroId);
    if (!heroState || heroState.isDead) return;

    if (this.myPlayerIdx === 1) {
      this.p1ActiveHero = heroId;
      this.p1CurrentHp = heroState.currentHp;
    } else {
      this.p2ActiveHero = heroId;
      this.p2CurrentHp = heroState.currentHp;
    }

    peerConnection.send({
      type: 'SELECT_ROUND_HERO',
      playerIdx: this.myPlayerIdx,
      heroId,
    });

    this.checkBothHeroesSelected();
    if (this.onStateChanged) this.onStateChanged();
  }

  private checkBothHeroesSelected() {
    if (this.p1ActiveHero && this.p2ActiveHero) {
      // Both selected their round heroes!
      if (this.isHost) {
        peerConnection.send({
          type: 'ROUND_START_PREP',
          roundNumber: this.currentRound,
          p1HeroId: this.p1ActiveHero,
          p2HeroId: this.p2ActiveHero,
          p1InitialHp: this.p1CurrentHp,
          p2InitialHp: this.p2CurrentHp,
        });
        this.prepareRoundArena();
      }
    }
  }

  private prepareRoundArena() {
    this.onlinePhase = 'AIMING';
    this.myReady = false;
    this.opponentReady = false;

    // Initialize arena balls with current remaining HP
    this.engine.initOnlineRound(
      this.p1ActiveHero!,
      this.p2ActiveHero!,
      this.p1CurrentHp,
      this.p2CurrentHp,
      this.myPlayerIdx
    );

    if (this.onStateChanged) this.onStateChanged();
  }

  // ==========================================
  // AIMING & READY
  // ==========================================

  public setMyAimAngle(angle: number) {
    this.myAimAngle = angle;
    if (this.myPlayerIdx === 1) {
      this.p1Angle = angle;
    } else {
      this.p2Angle = angle;
    }
    this.engine.setOnlineLocalAim(angle);
    if (this.onStateChanged) this.onStateChanged();
  }

  public setMyReady(ready: boolean) {
    if (this.onlinePhase !== 'AIMING') return;
    this.myReady = ready;

    if (this.myPlayerIdx === 1) {
      this.p1Angle = this.myAimAngle;
    } else {
      this.p2Angle = this.myAimAngle;
    }

    peerConnection.send({
      type: 'PLAYER_READY',
      playerIdx: this.myPlayerIdx,
      aimAngle: this.myAimAngle,
    });

    soundFX.playWallBounce(1.5);

    if (this.isHost) {
      if (this.myReady && this.opponentReady) {
        this.startCountdown();
      }
    }

    if (this.onStateChanged) this.onStateChanged();
  }

  private startCountdown() {
    this.onlinePhase = 'COUNTDOWN';
    peerConnection.send({
      type: 'START_COUNTDOWN',
      p1Angle: this.p1Angle,
      p2Angle: this.p2Angle,
    });
    this.engine.startOnlineCountdown(this.p1Angle, this.p2Angle);

    // After countdown completes (3.2s), host launches battle & starts streaming
    setTimeout(() => {
      this.launchBattle();
    }, 3200);

    if (this.onStateChanged) this.onStateChanged();
  }

  private launchBattle() {
    if (!this.isHost || this.onlinePhase !== 'COUNTDOWN') return;
    this.onlinePhase = 'BATTLE';
    peerConnection.send({
      type: 'LAUNCH_BATTLE',
      p1Angle: this.p1Angle,
      p2Angle: this.p2Angle,
    });
    this.engine.launchOnlineBattle(this.p1Angle, this.p2Angle);
    this.startSnapshotStream();
    if (this.onStateChanged) this.onStateChanged();
  }

  // ==========================================
  // HOST-AUTHORITATIVE COMBAT STREAMING
  // ==========================================

  private startSnapshotStream() {
    this.stopSnapshotStream();
    this.snapshotSeq = 0;
    this.snapshotTimer = window.setInterval(() => {
      if (this.onlinePhase !== 'BATTLE') {
        this.stopSnapshotStream();
        return;
      }
      this.broadcastCombatSnapshot();
    }, 33); // ~30 fps snapshot stream
  }

  private stopSnapshotStream() {
    if (this.snapshotTimer !== null) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  private broadcastCombatSnapshot() {
    if (!this.engine.p1Ball || !this.engine.p2Ball) return;

    const p1 = this.engine.p1Ball;
    const p2 = this.engine.p2Ball;
    const box = this.engine.box;
    const boxSize = box.size > 0 ? box.size : 480;

    this.snapshotSeq++;
    peerConnection.send({
      type: 'COMBAT_SNAPSHOT',
      seq: this.snapshotSeq,
      boxAngle: box.angle,
      p1: {
        x: p1.x,
        y: p1.y,
        nx: (p1.x - box.centerX) / boxSize,
        ny: (p1.y - box.centerY) / boxSize,
        vx: p1.vx,
        vy: p1.vy,
        nvx: p1.vx / boxSize,
        nvy: p1.vy / boxSize,
        hp: p1.hp,
        maxHp: p1.maxHp,
        facingAngle: p1.facingAngle,
        isSkillActive: p1.isSkillActive,
        cooldownTimer: p1.cooldownTimer,
        isDead: p1.isDead,
        damageDealt: p1.damageDealt,
        bounces: p1.bounces,
      },
      p2: {
        x: p2.x,
        y: p2.y,
        nx: (p2.x - box.centerX) / boxSize,
        ny: (p2.y - box.centerY) / boxSize,
        vx: p2.vx,
        vy: p2.vy,
        nvx: p2.vx / boxSize,
        nvy: p2.vy / boxSize,
        hp: p2.hp,
        maxHp: p2.maxHp,
        facingAngle: p2.facingAngle,
        isSkillActive: p2.isSkillActive,
        cooldownTimer: p2.cooldownTimer,
        isDead: p2.isDead,
        damageDealt: p2.damageDealt,
        bounces: p2.bounces,
      },
    });

    // Check if one ball died
    if (p1.isDead || p2.isDead || p1.hp <= 0 || p2.hp <= 0) {
      this.handleCombatEndOnHost();
    }
  }

  private applyCombatSnapshot(msg: Extract<NetworkMessage, { type: 'COMBAT_SNAPSHOT' }>) {
    if (!this.engine.p1Ball || !this.engine.p2Ball) return;

    this.engine.box.angle = msg.boxAngle;

    const box = this.engine.box;
    const boxSize = box.size > 0 ? box.size : 480;

    // Smoothly apply state using normalized coordinates
    const p1 = this.engine.p1Ball;
    if (msg.p1.nx !== undefined && msg.p1.ny !== undefined) {
      const targetX = box.centerX + msg.p1.nx * boxSize;
      const targetY = box.centerY + msg.p1.ny * boxSize;
      p1.x = p1.x + (targetX - p1.x) * 0.55;
      p1.y = p1.y + (targetY - p1.y) * 0.55;
      if (msg.p1.nvx !== undefined && msg.p1.nvy !== undefined) {
        p1.vx = msg.p1.nvx * boxSize;
        p1.vy = msg.p1.nvy * boxSize;
      }
    } else {
      p1.x = msg.p1.x;
      p1.y = msg.p1.y;
      p1.vx = msg.p1.vx;
      p1.vy = msg.p1.vy;
    }

    // Skill activation trigger on Guest
    if (!p1.isSkillActive && msg.p1.isSkillActive) {
      p1.isSkillActive = true;
      p1.skillStrategy.activate?.(p1, this.engine.balls, this.engine.vfx);
    } else if (p1.isSkillActive && !msg.p1.isSkillActive) {
      p1.isSkillActive = false;
      p1.skillStrategy.onEnd?.(p1, this.engine.balls, this.engine.vfx, true);
    }

    p1.hp = msg.p1.hp;
    p1.facingAngle = msg.p1.facingAngle;
    p1.isSkillActive = msg.p1.isSkillActive;
    p1.cooldownTimer = msg.p1.cooldownTimer;
    p1.isDead = msg.p1.isDead;
    p1.damageDealt = msg.p1.damageDealt;
    p1.bounces = msg.p1.bounces;

    const p2 = this.engine.p2Ball;
    if (msg.p2.nx !== undefined && msg.p2.ny !== undefined) {
      const targetX = box.centerX + msg.p2.nx * boxSize;
      const targetY = box.centerY + msg.p2.ny * boxSize;
      p2.x = p2.x + (targetX - p2.x) * 0.55;
      p2.y = p2.y + (targetY - p2.y) * 0.55;
      if (msg.p2.nvx !== undefined && msg.p2.nvy !== undefined) {
        p2.vx = msg.p2.nvx * boxSize;
        p2.vy = msg.p2.nvy * boxSize;
      }
    } else {
      p2.x = msg.p2.x;
      p2.y = msg.p2.y;
      p2.vx = msg.p2.vx;
      p2.vy = msg.p2.vy;
    }

    if (!p2.isSkillActive && msg.p2.isSkillActive) {
      p2.isSkillActive = true;
      p2.skillStrategy.activate?.(p2, this.engine.balls, this.engine.vfx);
    } else if (p2.isSkillActive && !msg.p2.isSkillActive) {
      p2.isSkillActive = false;
      p2.skillStrategy.onEnd?.(p2, this.engine.balls, this.engine.vfx, true);
    }

    p2.hp = msg.p2.hp;
    p2.facingAngle = msg.p2.facingAngle;
    p2.isSkillActive = msg.p2.isSkillActive;
    p2.cooldownTimer = msg.p2.cooldownTimer;
    p2.isDead = msg.p2.isDead;
    p2.damageDealt = msg.p2.damageDealt;
    p2.bounces = msg.p2.bounces;

    if (this.engine.onUpdateUI) this.engine.onUpdateUI();
  }

  // ==========================================
  // ROUND & MATCH TERMINATION (Host Only)
  // ==========================================

  private handleCombatEndOnHost() {
    this.stopSnapshotStream();

    const p1 = this.engine.p1Ball!;
    const p2 = this.engine.p2Ball!;

    let winnerPlayerIdx: 1 | 2 | null = null;
    let survivingHeroId: BallTypeId | null = null;
    let remainingHp = 0;

    if (p1.hp > 0 && p2.hp <= 0) {
      winnerPlayerIdx = 1;
      survivingHeroId = this.p1ActiveHero;
      remainingHp = Math.max(1, Math.round(p1.hp));
      this.p1CurrentHp = remainingHp;

      // Update rosters
      const p1Hero = this.p1Roster.find((r) => r.heroId === this.p1ActiveHero);
      if (p1Hero) p1Hero.currentHp = remainingHp;

      const p2Hero = this.p2Roster.find((r) => r.heroId === this.p2ActiveHero);
      if (p2Hero) {
        p2Hero.isDead = true;
        p2Hero.currentHp = 0;
      }
      this.p2ActiveHero = null; // P2 must counter-pick
    } else if (p2.hp > 0 && p1.hp <= 0) {
      winnerPlayerIdx = 2;
      survivingHeroId = this.p2ActiveHero;
      remainingHp = Math.max(1, Math.round(p2.hp));
      this.p2CurrentHp = remainingHp;

      // Update rosters
      const p2Hero = this.p2Roster.find((r) => r.heroId === this.p2ActiveHero);
      if (p2Hero) p2Hero.currentHp = remainingHp;

      const p1Hero = this.p1Roster.find((r) => r.heroId === this.p1ActiveHero);
      if (p1Hero) {
        p1Hero.isDead = true;
        p1Hero.currentHp = 0;
      }
      this.p1ActiveHero = null; // P1 must counter-pick
    } else {
      // Draw: both dead
      winnerPlayerIdx = null;
      survivingHeroId = null;
      remainingHp = 0;
      const p1Hero = this.p1Roster.find((r) => r.heroId === this.p1ActiveHero);
      if (p1Hero) {
        p1Hero.isDead = true;
        p1Hero.currentHp = 0;
      }
      const p2Hero = this.p2Roster.find((r) => r.heroId === this.p2ActiveHero);
      if (p2Hero) {
        p2Hero.isDead = true;
        p2Hero.currentHp = 0;
      }
      this.p1ActiveHero = null;
      this.p2ActiveHero = null;
    }

    // Check if entire team of 3 balls is eliminated
    const p1AllDead = this.p1Roster.every((r) => r.isDead);
    const p2AllDead = this.p2Roster.every((r) => r.isDead);

    if (p1AllDead || p2AllDead) {
      // MATCH OVER!
      const matchWinner: 1 | 2 = p1AllDead ? 2 : 1;
      this.onlinePhase = 'MATCH_OVER';

      peerConnection.send({
        type: 'MATCH_OVER',
        winnerPlayerIdx: matchWinner,
        p1Roster: this.p1Roster,
        p2Roster: this.p2Roster,
      });

      if (this.onMatchEnded) this.onMatchEnded(matchWinner);
    } else {
      // ROUND OVER -> Advance to next round & counter-pick!
      this.onlinePhase = 'ROUND_OVER';
      this.currentRound++;

      peerConnection.send({
        type: 'ROUND_RESULT',
        roundNumber: this.currentRound - 1,
        winnerPlayerIdx,
        survivingHeroId,
        remainingHp,
        p1Roster: this.p1Roster,
        p2Roster: this.p2Roster,
      });

      if (this.onRoundEnded) {
        this.onRoundEnded(winnerPlayerIdx, survivingHeroId, remainingHp);
      }
    }

    if (this.onStateChanged) this.onStateChanged();
  }

  public proceedFromRoundOverToCounterPick() {
    this.onlinePhase = 'SELECT_ROUND_HERO';
    if (this.onStateChanged) this.onStateChanged();
  }

  public requestRematch() {
    if (this.isHost) {
      this.resetMatchData();
      this.onlinePhase = 'DRAFT';
      peerConnection.send({ type: 'REMATCH_START' });
      if (this.onStateChanged) this.onStateChanged();
    } else {
      this.myReady = true;
      peerConnection.send({ type: 'REMATCH_REQUEST', fromPlayerIdx: this.myPlayerIdx });
      if (this.onStateChanged) this.onStateChanged();
    }
  }
}
