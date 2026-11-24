import type { GameMetadata } from '../types';
import { ChronoSlayer3D } from './ChronoSlayer3D';
import { ShadowReflexArena } from './ShadowReflexArena';

/**
 * Central Plug-and-Play Game Registry for Shadow Knight Game Zone.
 * Drop any new standalone game component in src/games/ and append a GameMetadata entry here
 * to publish it automatically across Hero Spotlight, Category Filters, Search, and Leaderboards.
 */
export const GAMES_REGISTRY: GameMetadata[] = [
  {
    id: 'chrono-slayer-3d',
    title: 'Chrono Slayer 3D',
    subtitle: 'Flagship 3D Cyber-Blade Action',
    description:
      'Wield a dual-energy crimson & cyan greatsword in a 3D rune arena. Chain 3-hit combos, draft Roguelike power-ups, and defeat the Wave 5 Void Titan Boss.',
    category: '3D Action',
    status: 'playable',
    isFeaturedHero: true,
    orientation: '16:9 Landscape',
    players: '1 Player',
    controlsSummary: 'Virtual Joystick + Attack/Dash/Nova · WASD + Space',
    artworkTheme: 'chrono-slayer',
    accentColor: 'crimson',
    releaseWindow: 'Playable Now',
    rating: 4.9,
    activePlayersLabel: '14.2K Playing',
    xpRewardMultiplier: 2.0,
    component: ChronoSlayer3D,
  },
  {
    id: 'shadow-reflex-arena',
    title: 'Shadow Reflex Arena',
    subtitle: '60fps Neon Precision Strikes',
    description:
      'Test your knight reflexes at 60fps. Shatter Cyan Orbs & Crimson Cores to stack combos while dodging spiked Void Mines.',
    category: 'Arcade & Reflex',
    status: 'playable',
    orientation: '16:9 Landscape',
    players: '1 Player',
    controlsSummary: 'Tap / Click Targets · Space Pause',
    artworkTheme: 'reflex-arena',
    accentColor: 'cyan',
    rating: 4.8,
    activePlayersLabel: '9.6K Playing',
    xpRewardMultiplier: 1.5,
    component: ShadowReflexArena,
  },
  {
    id: 'apex-drift-3d',
    title: 'Apex Drift 3D',
    subtitle: 'Midnight Highway Touge',
    description:
      'Master razor-edge neon hairpin drifts in custom-tuned hypercars across rain-slicked skyline circuits.',
    category: 'Racing & Drift',
    status: 'coming-soon',
    orientation: '16:9 Landscape',
    players: '1 Player · Ghost Time Trial',
    controlsSummary: 'Steer + Nitro Drift · Arrow Keys / Touch',
    artworkTheme: 'apex-drift',
    accentColor: 'cyan',
    releaseWindow: 'Upcoming Drop',
    rating: 4.9,
    activePlayersLabel: '5.1K Pre-Reg',
    xpRewardMultiplier: 1.6,
  },
  {
    id: 'void-survivor',
    title: 'Void Survivor',
    subtitle: '3D Horde Rogue-Lite',
    description:
      'Outlast escalating waves of abyssal drones, evolve orbital blades, and defeat the Void Leviathan.',
    category: '3D Action',
    status: 'coming-soon',
    orientation: '16:9 Landscape',
    players: '1 Player',
    controlsSummary: '360° Movement + Auto-Cast',
    artworkTheme: 'void-survivor',
    accentColor: 'crimson',
    releaseWindow: 'Upcoming Drop',
    rating: 4.7,
    activePlayersLabel: '4.4K Pre-Reg',
    xpRewardMultiplier: 1.7,
  },
  {
    id: 'neon-blade-2p',
    title: 'Neon Blade 2P',
    subtitle: 'Split-Screen Arena Duel',
    description:
      'Head-to-head local 2-player energy parry duel on one screen. First knight to 5 round knockouts claims the crown.',
    category: '2-Player',
    status: 'coming-soon',
    orientation: '16:9 Landscape',
    players: '2 Players (Same Device)',
    controlsSummary: 'Dual Touch Zones · A/D vs Left/Right',
    artworkTheme: 'neon-duel',
    accentColor: 'cyan',
    releaseWindow: 'Upcoming Drop',
    rating: 4.8,
    activePlayersLabel: '3.8K Pre-Reg',
    xpRewardMultiplier: 1.5,
  },
  {
    id: 'cyber-pulse-rush',
    title: 'Cyber Pulse Rush',
    subtitle: 'High-Speed Tunnel Runner',
    description:
      'Shift lanes at supersonic speed inside a shifting 3D cyber tunnel and chain energy gates for overdrive multipliers.',
    category: 'Racing & Drift',
    status: 'coming-soon',
    orientation: '16:9 Landscape',
    players: '1 Player',
    controlsSummary: 'Swipe Left/Right · A / D',
    artworkTheme: 'cyber-pulse',
    accentColor: 'crimson',
    releaseWindow: 'Upcoming Drop',
    rating: 4.6,
    activePlayersLabel: '2.9K Pre-Reg',
    xpRewardMultiplier: 1.4,
  },
];

export function getFeaturedHeroGame(): GameMetadata {
  return GAMES_REGISTRY.find((g) => g.isFeaturedHero) ?? GAMES_REGISTRY[0];
}

export function getPlayableStarterGame(): GameMetadata {
  return (
    GAMES_REGISTRY.find((g) => g.id === 'shadow-reflex-arena') ??
    GAMES_REGISTRY.find((g) => g.status === 'playable') ??
    GAMES_REGISTRY[0]
  );
}
