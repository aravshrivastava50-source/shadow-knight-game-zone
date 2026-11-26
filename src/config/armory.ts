import type { ArmoryPerkId, ArmorySkinId } from '../types';

export interface ArmorySkinConfig {
  id: ArmorySkinId;
  name: string;
  subtitle: string;
  cost: number;
  accentHex: number;
  armorHex: number;
  accentCss: string;
  secondaryCss: string;
}

export interface ArmoryPerkConfig {
  id: ArmoryPerkId;
  name: string;
  description: string;
  cost: number;
  badgeText: string;
  accentCss: string;
}

export const ARMORY_SKINS: ArmorySkinConfig[] = [
  {
    id: 'cyber-cyan',
    name: 'Cyber Cyan Vanguard',
    subtitle: 'Standard Shadow Knight titanium armor & plasma cyan edge',
    cost: 0,
    accentHex: 0x00f0ff,
    armorHex: 0x1d2336,
    accentCss: '#00F0FF',
    secondaryCss: '#0EA5E9',
  },
  {
    id: 'crimson-hellfire',
    name: 'Crimson Hellfire',
    subtitle: 'Obsidian battleplate with incandescent crimson-scarlet katana',
    cost: 150,
    accentHex: 0xff1e42,
    armorHex: 0x1c0d16,
    accentCss: '#FF1E42',
    secondaryCss: '#F97316',
  },
  {
    id: 'solar-gold',
    name: 'Solar Sovereign',
    subtitle: 'Gilded royal knight alloy & radiant amber energy blade',
    cost: 300,
    accentHex: 0xfacc15,
    armorHex: 0x262015,
    accentCss: '#FACC15',
    secondaryCss: '#F59E0B',
  },
  {
    id: 'void-amethyst',
    name: 'Void Amethyst',
    subtitle: 'Dark phantom titanium infused with ultraviolet rift energy',
    cost: 450,
    accentHex: 0xc084fc,
    armorHex: 0x1a122e,
    accentCss: '#C084FC',
    secondaryCss: '#A855F7',
  },
];

export const ARMORY_PERKS: ArmoryPerkConfig[] = [
  {
    id: 'vital-core',
    name: 'Vital Armor Core',
    description: '+35 Max HP in Chrono Slayer 3D (185 HP) and +1 extra Shield in Shadow Reflex Arena.',
    cost: 180,
    badgeText: '+35 HP / +1 Shield',
    accentCss: '#34D399',
  },
  {
    id: 'chrono-battery',
    name: 'Chrono Overcharge Cell',
    description: 'Start Chrono Slayer 3D with 75% Cosmic Nova charge & earn +15% bonus points in Reflex Arena.',
    cost: 240,
    badgeText: '75% Nova / +15% Pts',
    accentCss: '#00F0FF',
  },
  {
    id: 'blade-tempering',
    name: 'Hyper-Edge Tempering',
    description: '+20% base sword damage in Chrono Slayer 3D and wider slash hit radius in Reflex Arena.',
    cost: 320,
    badgeText: '+20% DMG / Wide Slash',
    accentCss: '#FF1E42',
  },
];

export function getArmorySkinConfig(skinId?: ArmorySkinId): ArmorySkinConfig {
  return ARMORY_SKINS.find((s) => s.id === skinId) ?? ARMORY_SKINS[0];
}
