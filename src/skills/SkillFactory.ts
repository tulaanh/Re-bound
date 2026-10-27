import type { BallTypeId } from '../types';
import type { SkillStrategy } from './SkillStrategy';
import { BlazeSkill } from './BlazeSkill';
import { FrostSkill } from './FrostSkill';
import { VoltSkill } from './VoltSkill';
import { VoidSkill } from './VoidSkill';
import { ToxicSkill } from './ToxicSkill';
import { VampireSkill } from './VampireSkill';
import { MeteorSkill } from './MeteorSkill';
import { AxeSkill } from './AxeSkill';
import { NecroSkill } from './NecroSkill';
import { SlimeSkill } from './SlimeSkill';
import { GokuSkill } from './GokuSkill';
import { ClownSkill } from './ClownSkill';
import { TitanSkill } from './TitanSkill';
import { WoodSkill } from './WoodSkill';
import { DaggerSkill } from './DaggerSkill';
import { SpiderSkill } from './SpiderSkill';

export function createSkillStrategy(typeId: BallTypeId): SkillStrategy {
  switch (typeId) {
    case 'BLAZE':
      return new BlazeSkill();
    case 'FROST':
      return new FrostSkill();
    case 'VOLT':
      return new VoltSkill();
    case 'VOID':
      return new VoidSkill();
    case 'TOXIC':
      return new ToxicSkill();
    case 'VAMPIRE':
      return new VampireSkill();
    case 'METEOR':
      return new MeteorSkill();
    case 'AXE':
      return new AxeSkill();
    case 'NECRO':
      return new NecroSkill();
    case 'SLIME':
      return new SlimeSkill();
    case 'GOKU':
      return new GokuSkill();
    case 'CLOWN':
      return new ClownSkill();
    case 'TITAN':
      return new TitanSkill();
    case 'WOOD':
      return new WoodSkill();
    case 'DAGGER':
      return new DaggerSkill();
    case 'SPIDER':
      return new SpiderSkill();
  }
}
