import type {
  ArmoryPerkId,
  ArmorySkinId,
  GameSessionResult,
  LeaderboardEntry,
  PlayerProfile,
} from '../types';

const PROFILE_STORAGE_KEY = 'skgz_player_profile_v1';
const LEADERBOARD_STORAGE_KEY = 'skgz_leaderboard_v1';
const VALID_SKINS = new Set<ArmorySkinId>([
  'cyber-cyan',
  'crimson-hellfire',
  'solar-gold',
  'void-amethyst',
]);
const VALID_PERKS = new Set<ArmoryPerkId>([
  'vital-core',
  'chrono-battery',
  'blade-tempering',
]);

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayIsoDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

const DEFAULT_PROFILE: PlayerProfile = {
  gamerTag: 'ShadowKnight_01',
  xp: 120,
  coins: 50,
  streak: 1,
  lastActiveDate: getTodayIsoDate(),
  gamesPlayed: 0,
  highScores: {},
  preRegisteredIds: [],
  equippedSkin: 'cyber-cyan',
  unlockedSkins: ['cyber-cyan'],
  unlockedPerks: [],
  soundMuted: false,
};

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    gamerTag: 'VoidValkyrie',
    gameId: 'shadow-reflex-arena',
    gameTitle: 'Shadow Reflex Arena',
    score: 2840,
    maxCombo: 18,
    recordedAt: '2026-11-23',
  },
  {
    id: 'seed-2',
    gamerTag: 'CrimsonBladeX',
    gameId: 'shadow-reflex-arena',
    gameTitle: 'Shadow Reflex Arena',
    score: 2190,
    maxCombo: 14,
    recordedAt: '2026-11-22',
  },
  {
    id: 'seed-3',
    gamerTag: 'NeonPhantom99',
    gameId: 'shadow-reflex-arena',
    gameTitle: 'Shadow Reflex Arena',
    score: 1650,
    maxCombo: 11,
    recordedAt: '2026-11-22',
  },
  {
    id: 'seed-4',
    gamerTag: 'ApexStriker',
    gameId: 'shadow-reflex-arena',
    gameTitle: 'Shadow Reflex Arena',
    score: 1120,
    maxCombo: 8,
    recordedAt: '2026-11-21',
  },
];

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      savePlayerProfile(DEFAULT_PROFILE);
      return DEFAULT_PROFILE;
    }

    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const today = getTodayIsoDate();
    const yesterday = getYesterdayIsoDate();

    let streak = typeof parsed.streak === 'number' && parsed.streak >= 1 ? parsed.streak : 1;
    const lastActive = parsed.lastActiveDate || today;

    if (lastActive === yesterday) {
      streak += 1;
    } else if (lastActive !== today) {
      streak = 1;
    }

    const rawUnlockedSkins = Array.isArray(parsed.unlockedSkins)
      ? parsed.unlockedSkins.filter((s): s is ArmorySkinId => VALID_SKINS.has(s as ArmorySkinId))
      : [];
    const unlockedSkins: ArmorySkinId[] = Array.from(
      new Set<ArmorySkinId>(['cyber-cyan', ...rawUnlockedSkins])
    );

    const equippedSkin: ArmorySkinId =
      parsed.equippedSkin && unlockedSkins.includes(parsed.equippedSkin)
        ? parsed.equippedSkin
        : 'cyber-cyan';

    const unlockedPerks: ArmoryPerkId[] = Array.isArray(parsed.unlockedPerks)
      ? Array.from(
          new Set(
            parsed.unlockedPerks.filter((p): p is ArmoryPerkId =>
              VALID_PERKS.has(p as ArmoryPerkId)
            )
          )
        )
      : [];

    const normalized: PlayerProfile = {
      gamerTag:
        typeof parsed.gamerTag === 'string' && parsed.gamerTag.trim().length > 0
          ? parsed.gamerTag.trim().slice(0, 18)
          : DEFAULT_PROFILE.gamerTag,
      xp: typeof parsed.xp === 'number' ? Math.max(0, parsed.xp) : DEFAULT_PROFILE.xp,
      coins: typeof parsed.coins === 'number' ? Math.max(0, parsed.coins) : DEFAULT_PROFILE.coins,
      streak,
      lastActiveDate: today,
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? Math.max(0, parsed.gamesPlayed) : 0,
      highScores: parsed.highScores && typeof parsed.highScores === 'object' ? parsed.highScores : {},
      preRegisteredIds: Array.isArray(parsed.preRegisteredIds) ? parsed.preRegisteredIds : [],
      equippedSkin,
      unlockedSkins,
      unlockedPerks,
      soundMuted: Boolean(parsed.soundMuted),
    };

    if (lastActive !== today) {
      // Award daily streak login bonus coins on a fresh day
      normalized.coins += 25;
      normalized.xp += 30;
      savePlayerProfile(normalized);
    }

    return normalized;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore quota errors in restricted storage environments
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(SEED_LEADERBOARD));
      return SEED_LEADERBOARD;
    }
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return SEED_LEADERBOARD;
    }
    return [...parsed].sort((a, b) => b.score - a.score).slice(0, 20);
  } catch {
    return SEED_LEADERBOARD;
  }
}

export function recordGameSession(
  currentProfile: PlayerProfile,
  result: GameSessionResult
): { profile: PlayerProfile; leaderboard: LeaderboardEntry[]; isNewHighScore: boolean } {
  const prevBest = currentProfile.highScores[result.gameId] ?? 0;
  const isNewHighScore = result.score > prevBest;

  const updatedProfile: PlayerProfile = {
    ...currentProfile,
    xp: currentProfile.xp + result.xpEarned,
    coins: currentProfile.coins + result.coinsEarned,
    gamesPlayed: currentProfile.gamesPlayed + 1,
    lastActiveDate: getTodayIsoDate(),
    highScores: {
      ...currentProfile.highScores,
      [result.gameId]: Math.max(prevBest, result.score),
    },
  };

  savePlayerProfile(updatedProfile);

  const currentBoard = loadLeaderboard();
  const nextBoard: LeaderboardEntry[] = [
    ...currentBoard,
    {
      id: `run-${Date.now()}`,
      gamerTag: updatedProfile.gamerTag,
      gameId: result.gameId,
      gameTitle: result.gameTitle,
      score: result.score,
      maxCombo: result.maxCombo,
      recordedAt: getTodayIsoDate(),
      isCurrentPlayer: true,
    },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(nextBoard));
  } catch {
    // Ignore storage write failure
  }

  return {
    profile: updatedProfile,
    leaderboard: nextBoard,
    isNewHighScore,
  };
}

export function getLevelFromXp(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  const xpPerLevel = 250;
  const level = Math.floor(xp / xpPerLevel) + 1;
  const currentLevelXp = xp % xpPerLevel;
  const progressPercent = Math.min(100, Math.round((currentLevelXp / xpPerLevel) * 100));
  return {
    level,
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    progressPercent,
  };
}

export function purchaseOrEquipSkin(
  profile: PlayerProfile,
  skinId: ArmorySkinId,
  cost: number
): { profile: PlayerProfile; changed: boolean } {
  if (profile.unlockedSkins.includes(skinId)) {
    if (profile.equippedSkin === skinId) {
      return { profile, changed: false };
    }
    const next: PlayerProfile = { ...profile, equippedSkin: skinId };
    savePlayerProfile(next);
    return { profile: next, changed: true };
  }
  if (profile.coins < cost) {
    return { profile, changed: false };
  }
  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins - cost,
    unlockedSkins: Array.from(new Set<ArmorySkinId>([...profile.unlockedSkins, skinId])),
    equippedSkin: skinId,
  };
  savePlayerProfile(next);
  return { profile: next, changed: true };
}

export function purchaseArmoryPerk(
  profile: PlayerProfile,
  perkId: ArmoryPerkId,
  cost: number
): { profile: PlayerProfile; changed: boolean } {
  if (profile.unlockedPerks.includes(perkId) || profile.coins < cost) {
    return { profile, changed: false };
  }
  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins - cost,
    unlockedPerks: Array.from(new Set<ArmoryPerkId>([...profile.unlockedPerks, perkId])),
  };
  savePlayerProfile(next);
  return { profile: next, changed: true };
}

export function mergeLocalAndCloudProfile(
  local: PlayerProfile,
  cloud: Partial<PlayerProfile>
): PlayerProfile {
  const mergedScores: Record<string, number> = { ...local.highScores };
  if (cloud.highScores && typeof cloud.highScores === 'object') {
    for (const [gameId, score] of Object.entries(cloud.highScores)) {
      if (typeof score === 'number' && Number.isFinite(score)) {
        mergedScores[gameId] = Math.max(mergedScores[gameId] ?? 0, score);
      }
    }
  }

  const cloudSkins = Array.isArray(cloud.unlockedSkins)
    ? cloud.unlockedSkins.filter((s): s is ArmorySkinId => VALID_SKINS.has(s as ArmorySkinId))
    : [];
  const unlockedSkins = Array.from(
    new Set<ArmorySkinId>(['cyber-cyan', ...local.unlockedSkins, ...cloudSkins])
  );

  const cloudPerks = Array.isArray(cloud.unlockedPerks)
    ? cloud.unlockedPerks.filter((p): p is ArmoryPerkId => VALID_PERKS.has(p as ArmoryPerkId))
    : [];
  const unlockedPerks = Array.from(
    new Set<ArmoryPerkId>([...local.unlockedPerks, ...cloudPerks])
  );

  const preferredTag =
    cloud.gamerTag && cloud.gamerTag !== 'ShadowKnight_01'
      ? cloud.gamerTag
      : local.gamerTag;

  const equippedSkin =
    cloud.equippedSkin && unlockedSkins.includes(cloud.equippedSkin)
      ? cloud.equippedSkin
      : local.equippedSkin;

  const merged: PlayerProfile = {
    gamerTag: preferredTag.trim().slice(0, 18) || 'ShadowKnight_01',
    xp: Math.max(local.xp, typeof cloud.xp === 'number' ? cloud.xp : 0),
    coins: Math.max(local.coins, typeof cloud.coins === 'number' ? cloud.coins : 0),
    streak: Math.max(local.streak, typeof cloud.streak === 'number' ? cloud.streak : 1),
    lastActiveDate: getTodayIsoDate(),
    gamesPlayed: Math.max(
      local.gamesPlayed,
      typeof cloud.gamesPlayed === 'number' ? cloud.gamesPlayed : 0
    ),
    highScores: mergedScores,
    preRegisteredIds: Array.from(
      new Set([
        ...local.preRegisteredIds,
        ...(Array.isArray(cloud.preRegisteredIds) ? cloud.preRegisteredIds : []),
      ])
    ),
    equippedSkin,
    unlockedSkins,
    unlockedPerks,
    soundMuted: local.soundMuted,
  };

  savePlayerProfile(merged);
  return merged;
}

export function buildWhatsAppChallengeUrl(gameTitle: string, score?: number): string {
  const portalUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://shadow-knight-game-zone.vercel.app';
  const message =
    typeof score === 'number' && score > 0
      ? `I just scored ${score.toLocaleString()} pts in ${gameTitle} on Shadow Knight Game Zone! Think you can beat my record? Play now: ${portalUrl}`
      : `Join me on Shadow Knight Game Zone and test your reflexes in ${gameTitle}! Play now: ${portalUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
