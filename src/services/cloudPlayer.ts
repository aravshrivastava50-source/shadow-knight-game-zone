import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  GameMetadata,
  GameSessionResult,
  LeaderboardEntry,
  PlayerProfile,
  PortalRemoteSettings,
} from '../types';
import { mergeLocalAndCloudProfile } from '../utils/playerStorage';
import { sanitizeHttpsUrl } from './cloudCatalog';

const OWNER_EMAIL = 'aravshrivastava50@gmail.com';

export function isOwnerUser(user: User | null): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  return user.email.toLowerCase() === OWNER_EMAIL;
}

export function subscribeToAuthState(
  onUserChange: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, onUserChange);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutPlayer(): Promise<void> {
  await signOut(auth);
}

function buildPlayerPayload(uid: string, profile: PlayerProfile) {
  return {
    uid,
    gamerTag: profile.gamerTag.trim().slice(0, 18) || 'ShadowKnight_01',
    xp: Math.max(0, Math.min(100_000_000, Math.round(profile.xp))),
    coins: Math.max(0, Math.min(100_000_000, Math.round(profile.coins))),
    streak: Math.max(1, Math.min(36_500, Math.round(profile.streak))),
    lastActiveDate: profile.lastActiveDate.slice(0, 12),
    gamesPlayed: Math.max(0, Math.min(1_000_000, Math.round(profile.gamesPlayed))),
    highScores: profile.highScores,
    preRegisteredIds: profile.preRegisteredIds.slice(0, 50),
    equippedSkin: profile.equippedSkin,
    unlockedSkins: profile.unlockedSkins.slice(0, 10),
    unlockedPerks: profile.unlockedPerks.slice(0, 10),
    soundMuted: Boolean(profile.soundMuted),
  };
}

export async function syncAndMergePlayerProfile(
  user: User,
  localProfile: PlayerProfile
): Promise<PlayerProfile> {
  const playerPath = `players/${user.uid}`;
  const playerRef = doc(db, 'players', user.uid);

  try {
    const snap = await getDoc(playerRef);
    if (snap.exists()) {
      const cloudData = snap.data() as Partial<PlayerProfile>;
      const merged = mergeLocalAndCloudProfile(localProfile, cloudData);
      const payload = buildPlayerPayload(user.uid, merged);
      await updateDoc(playerRef, {
        gamerTag: payload.gamerTag,
        xp: payload.xp,
        coins: payload.coins,
        streak: payload.streak,
        lastActiveDate: payload.lastActiveDate,
        gamesPlayed: payload.gamesPlayed,
        highScores: payload.highScores,
        preRegisteredIds: payload.preRegisteredIds,
        equippedSkin: payload.equippedSkin,
        unlockedSkins: payload.unlockedSkins,
        unlockedPerks: payload.unlockedPerks,
        soundMuted: payload.soundMuted,
        updatedAt: serverTimestamp(),
      });
      return merged;
    }

    const fallbackTag =
      localProfile.gamerTag === 'ShadowKnight_01' && user.displayName
        ? user.displayName.replace(/\s+/g, '').slice(0, 18) || localProfile.gamerTag
        : localProfile.gamerTag;

    const initialProfile: PlayerProfile = {
      ...localProfile,
      gamerTag: fallbackTag,
    };
    const payload = buildPlayerPayload(user.uid, initialProfile);
    await setDoc(playerRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return initialProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, playerPath);
  }
}

export async function saveCloudPlayerProfile(
  uid: string,
  profile: PlayerProfile
): Promise<void> {
  const playerPath = `players/${uid}`;
  const playerRef = doc(db, 'players', uid);
  const payload = buildPlayerPayload(uid, profile);

  try {
    const snap = await getDoc(playerRef);
    if (snap.exists()) {
      await updateDoc(playerRef, {
        gamerTag: payload.gamerTag,
        xp: payload.xp,
        coins: payload.coins,
        streak: payload.streak,
        lastActiveDate: payload.lastActiveDate,
        gamesPlayed: payload.gamesPlayed,
        highScores: payload.highScores,
        preRegisteredIds: payload.preRegisteredIds,
        equippedSkin: payload.equippedSkin,
        unlockedSkins: payload.unlockedSkins,
        unlockedPerks: payload.unlockedPerks,
        soundMuted: payload.soundMuted,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(playerRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, playerPath);
  }
}

export async function submitGlobalLeaderboardScore(
  user: User,
  profile: PlayerProfile,
  result: GameSessionResult
): Promise<void> {
  if (result.score <= 0) return;

  const entryId = `${user.uid}_${result.gameId}_${Date.now()}`.slice(0, 120);
  const entryPath = `leaderboard/${entryId}`;
  const entryRef = doc(db, 'leaderboard', entryId);

  try {
    await setDoc(entryRef, {
      id: entryId,
      uid: user.uid,
      gamerTag: profile.gamerTag.trim().slice(0, 18) || 'ShadowKnight_01',
      gameId: result.gameId.slice(0, 64),
      gameTitle: result.gameTitle.trim().slice(0, 80),
      score: Math.max(0, Math.min(10_000_000, Math.round(result.score))),
      maxCombo: Math.max(1, Math.min(9999, Math.round(result.maxCombo || 1))),
      accuracy: Math.max(0, Math.min(100, Math.round(result.accuracy || 0))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, entryPath);
  }
}

function formatLeaderboardDate(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'toDate' in raw) {
    const ts = raw as Timestamp;
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export function subscribeToGlobalLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  currentUid?: string | null,
  gameFilter?: string
): () => void {
  const leaderboardPath = 'leaderboard';
  const baseCol = collection(db, leaderboardPath);
  const leaderboardQuery =
    gameFilter && gameFilter !== 'all'
      ? query(
          baseCol,
          where('gameId', '==', gameFilter),
          where('score', '>=', 0),
          orderBy('score', 'desc'),
          limit(25)
        )
      : query(
          baseCol,
          where('score', '>=', 0),
          orderBy('score', 'desc'),
          limit(25)
        );

  return onSnapshot(
    leaderboardQuery,
    (snapshot) => {
      const entries: LeaderboardEntry[] = snapshot.docs.map((snap) => {
        const data = snap.data() as Record<string, unknown>;
        return {
          id: typeof data.id === 'string' ? data.id : snap.id,
          uid: typeof data.uid === 'string' ? data.uid : undefined,
          gamerTag:
            typeof data.gamerTag === 'string' ? data.gamerTag : 'ShadowKnight',
          gameId: typeof data.gameId === 'string' ? data.gameId : 'shadow-reflex-arena',
          gameTitle:
            typeof data.gameTitle === 'string' ? data.gameTitle : 'Shadow Reflex Arena',
          score: typeof data.score === 'number' ? data.score : 0,
          maxCombo: typeof data.maxCombo === 'number' ? data.maxCombo : 1,
          accuracy: typeof data.accuracy === 'number' ? data.accuracy : undefined,
          recordedAt: formatLeaderboardDate(data.createdAt),
          isCurrentPlayer: Boolean(currentUid && data.uid === currentUid),
          isCloudVerified: true,
        };
      });
      onUpdate(entries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, leaderboardPath);
      } catch {
        // Fallback silently to empty cloud list so UI retains local entries
        onUpdate([]);
      }
    }
  );
}

export async function saveOwnerPortalSettings(
  uid: string,
  settings: PortalRemoteSettings
): Promise<void> {
  const configPath = 'portal_settings/config';
  const configRef = doc(db, 'portal_settings', 'config');

  const payload = {
    welcomeAnnouncement: settings.welcomeAnnouncement.trim().slice(0, 140),
    welcomeSubtitle: settings.welcomeSubtitle.trim().slice(0, 200),
    whatsappSupportNumber: settings.whatsappSupportNumber.trim().slice(0, 32),
    maintenanceMode: Boolean(settings.maintenanceMode),
    maintenanceMessage: settings.maintenanceMessage.trim().slice(0, 300),
    updatedByUid: uid,
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      await updateDoc(configRef, payload);
    } else {
      await setDoc(configRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, configPath);
  }
}

export interface PublishCloudGameInput {
  id: string;
  title: string;
  creatorStudio: string;
  category: GameMetadata['category'];
  subtitle: string;
  description: string;
  thumbnailUrl: string;
  gameBundleUrl: string;
  isLandscapeOnly: boolean;
  accentColor: 'crimson' | 'cyan';
  xpRewardMultiplier: number;
}

export async function publishOwnerCloudGame(
  uid: string,
  input: PublishCloudGameInput
): Promise<void> {
  const cleanId = input.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);

  const safeBundle = sanitizeHttpsUrl(input.gameBundleUrl);
  const safeThumb = sanitizeHttpsUrl(input.thumbnailUrl) || '/logo.png';

  if (!cleanId || cleanId.length < 2) {
    throw new Error('Game ID must have at least 2 valid characters.');
  }
  if (!safeBundle) {
    throw new Error('Game Bundle URL must be a valid https:// URL.');
  }

  const gamePath = `published_games/${cleanId}`;
  const gameRef = doc(db, 'published_games', cleanId);

  try {
    await setDoc(gameRef, {
      id: cleanId,
      title: input.title.trim().slice(0, 80),
      creatorStudio: input.creatorStudio.trim().slice(0, 80) || 'Shadow Knight Studio',
      category: input.category,
      subtitle: input.subtitle.trim().slice(0, 100),
      description: input.description.trim().slice(0, 500),
      thumbnailUrl: safeThumb,
      gameBundleUrl: safeBundle,
      isLandscapeOnly: Boolean(input.isLandscapeOnly),
      legalRightsVerified: true,
      accentColor: input.accentColor,
      rating: 4.9,
      activePlayersLabel: 'Official Cloud Drop',
      xpRewardMultiplier: Math.max(0.5, Math.min(5, input.xpRewardMultiplier || 1.5)),
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, gamePath);
  }
}
