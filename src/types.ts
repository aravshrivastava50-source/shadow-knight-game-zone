import type { ComponentType } from 'react';

export type GameCategory =
  | 'All Games'
  | 'Community & Creator Games'
  | '3D Action'
  | 'Racing & Drift'
  | 'Arcade & Reflex'
  | '2-Player'
  | 'Coming Soon';

export type GameArtworkTheme =
  | 'reflex-arena'
  | 'chrono-slayer'
  | 'apex-drift'
  | 'void-survivor'
  | 'neon-duel'
  | 'cyber-pulse';

export interface GameSessionResult {
  gameId: string;
  gameTitle: string;
  score: number;
  maxCombo: number;
  accuracy: number;
  xpEarned: number;
  coinsEarned: number;
}

export type ArmorySkinId = 'cyber-cyan' | 'crimson-hellfire' | 'solar-gold' | 'void-amethyst';

export type ArmoryPerkId = 'vital-core' | 'chrono-battery' | 'blade-tempering';

export interface GameComponentProps {
  gameId: string;
  gameTitle: string;
  bestScore: number;
  isMuted: boolean;
  equippedSkin?: ArmorySkinId;
  unlockedPerks?: ArmoryPerkId[];
  onToggleMute: () => void;
  onSessionComplete: (result: GameSessionResult) => void;
  onExit: () => void;
}

export interface GameMetadata {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: Exclude<GameCategory, 'All Games' | 'Coming Soon' | 'Community & Creator Games'>;
  status: 'playable' | 'coming-soon';
  isFeaturedHero?: boolean;
  isCommunityGame?: boolean;
  creatorStudio?: string;
  thumbnailUrl?: string;
  gameBundleUrl?: string;
  isLandscapeOnly?: boolean;
  legalRightsVerified?: boolean;
  createdAt?: string;
  orientation: '16:9 Landscape' | '16:9 / Responsive';
  players: string;
  controlsSummary: string;
  artworkTheme: GameArtworkTheme;
  accentColor: 'crimson' | 'cyan';
  releaseWindow?: string;
  rating: number;
  activePlayersLabel: string;
  xpRewardMultiplier: number;
  component?: ComponentType<GameComponentProps>;
}

export interface PublishedGameDoc {
  id: string;
  title: string;
  creatorStudio: string;
  category: Exclude<GameCategory, 'All Games' | 'Coming Soon' | 'Community & Creator Games'>;
  subtitle?: string;
  description?: string;
  thumbnailUrl: string;
  gameBundleUrl: string;
  isLandscapeOnly: boolean;
  legalRightsVerified: boolean;
  accentColor?: 'crimson' | 'cyan';
  rating?: number;
  activePlayersLabel?: string;
  xpRewardMultiplier?: number;
  createdAt: string;
}

export interface PortalRemoteSettings {
  welcomeAnnouncement: string;
  welcomeSubtitle: string;
  whatsappSupportNumber: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt?: string;
}

export interface PlayerProfile {
  gamerTag: string;
  xp: number;
  coins: number;
  streak: number;
  lastActiveDate: string;
  gamesPlayed: number;
  highScores: Record<string, number>;
  preRegisteredIds: string[];
  equippedSkin: ArmorySkinId;
  unlockedSkins: ArmorySkinId[];
  unlockedPerks: ArmoryPerkId[];
  soundMuted: boolean;
}

export interface LeaderboardEntry {
  id: string;
  uid?: string;
  gamerTag: string;
  gameId: string;
  gameTitle: string;
  score: number;
  maxCombo: number;
  accuracy?: number;
  recordedAt: string;
  isCurrentPlayer?: boolean;
  isCloudVerified?: boolean;
}
