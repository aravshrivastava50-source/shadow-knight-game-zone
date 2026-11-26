import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { SUPPORT_CONTACT } from '../config/contact';
import {
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from '../firebase';
import type {
  GameArtworkTheme,
  GameMetadata,
  PortalRemoteSettings,
  PublishedGameDoc,
} from '../types';

const CLOUD_GAMES_CACHE_KEY = 'skgz_cloud_games_cache_v1';
const PORTAL_SETTINGS_CACHE_KEY = 'skgz_portal_settings_cache_v1';

const VALID_CATEGORIES = new Set<PublishedGameDoc['category']>([
  '3D Action',
  'Racing & Drift',
  'Arcade & Reflex',
  '2-Player',
]);

const DEFAULT_PORTAL_SETTINGS: PortalRemoteSettings = {
  welcomeAnnouncement: 'Welcome to Shadow Knight Game Zone',
  welcomeSubtitle: 'Instant 16:9 3D WebGL & Arcade Portal',
  whatsappSupportNumber: SUPPORT_CONTACT.whatsappDisplay,
  maintenanceMode: false,
  maintenanceMessage:
    'Shadow Knight Game Zone is currently deploying a scheduled arena upgrade. Back online shortly.',
};

export function sanitizeHttpsUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (trimmed.length < 8 || trimmed.length > 1024) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function resolveCloudStorageOrHttpsUrl(rawUrl: unknown): Promise<string | null> {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 1024) return null;

  if (trimmed.startsWith('https://')) {
    return sanitizeHttpsUrl(trimmed);
  }

  // Reject unsafe schemes immediately
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('http://')
  ) {
    return null;
  }

  // Resolve Firebase Storage gs:// URI or relative bucket path
  try {
    const storageRef = ref(storage, trimmed);
    const downloadUrl = await getDownloadURL(storageRef);
    return sanitizeHttpsUrl(downloadUrl);
  } catch {
    return null;
  }
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const ts = value as Timestamp;
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toISOString();
    }
  }
  return new Date().toISOString();
}

function inferArtworkTheme(category: PublishedGameDoc['category']): GameArtworkTheme {
  switch (category) {
    case '3D Action':
      return 'chrono-slayer';
    case 'Racing & Drift':
      return 'apex-drift';
    case '2-Player':
      return 'neon-duel';
    case 'Arcade & Reflex':
    default:
      return 'reflex-arena';
  }
}

function toCloudGameMetadata(docData: PublishedGameDoc): GameMetadata {
  return {
    id: docData.id,
    title: docData.title,
    subtitle: docData.subtitle || `By ${docData.creatorStudio}`,
    description:
      docData.description ||
      `Verified creator release by ${docData.creatorStudio}. Play directly in 16:9 Landscape mode and earn portal XP.`,
    category: docData.category,
    status: 'playable',
    isCommunityGame: true,
    creatorStudio: docData.creatorStudio,
    thumbnailUrl: docData.thumbnailUrl,
    gameBundleUrl: docData.gameBundleUrl,
    isLandscapeOnly: docData.isLandscapeOnly,
    legalRightsVerified: docData.legalRightsVerified,
    createdAt: docData.createdAt,
    orientation: docData.isLandscapeOnly ? '16:9 Landscape' : '16:9 / Responsive',
    players: docData.category === '2-Player' ? '2 Players' : '1 Player',
    controlsSummary: 'Touch & Keyboard · Sandboxed WebGL / HTML5 Stage',
    artworkTheme: inferArtworkTheme(docData.category),
    accentColor: docData.accentColor === 'crimson' ? 'crimson' : 'cyan',
    releaseWindow: 'Live Cloud Drop',
    rating:
      typeof docData.rating === 'number' && docData.rating >= 0 && docData.rating <= 5
        ? docData.rating
        : 4.8,
    activePlayersLabel: docData.activePlayersLabel || 'Creator Release',
    xpRewardMultiplier:
      typeof docData.xpRewardMultiplier === 'number' &&
      docData.xpRewardMultiplier >= 0.5 &&
      docData.xpRewardMultiplier <= 5
        ? docData.xpRewardMultiplier
        : 1.5,
  };
}

export function loadCachedCloudGames(): GameMetadata[] {
  try {
    const raw = localStorage.getItem(CLOUD_GAMES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublishedGameDoc[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          item.legalRightsVerified === true &&
          sanitizeHttpsUrl(item.gameBundleUrl) !== null
      )
      .map(toCloudGameMetadata);
  } catch {
    return [];
  }
}

function saveCachedCloudGames(docs: PublishedGameDoc[]): void {
  try {
    localStorage.setItem(CLOUD_GAMES_CACHE_KEY, JSON.stringify(docs));
  } catch {
    // Ignore localStorage quota failures
  }
}

export function loadCachedPortalSettings(): PortalRemoteSettings {
  try {
    const raw = localStorage.getItem(PORTAL_SETTINGS_CACHE_KEY);
    if (!raw) return DEFAULT_PORTAL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PortalRemoteSettings>;
    return normalizePortalSettings(parsed);
  } catch {
    return DEFAULT_PORTAL_SETTINGS;
  }
}

function saveCachedPortalSettings(settings: PortalRemoteSettings): void {
  try {
    localStorage.setItem(PORTAL_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage quota failures
  }
}

function normalizePortalSettings(raw: Record<string, unknown>): PortalRemoteSettings {
  const welcomeAnnouncement =
    typeof raw.welcomeAnnouncement === 'string' && raw.welcomeAnnouncement.trim().length >= 2
      ? raw.welcomeAnnouncement.trim().slice(0, 140)
      : DEFAULT_PORTAL_SETTINGS.welcomeAnnouncement;

  const welcomeSubtitle =
    typeof raw.welcomeSubtitle === 'string' && raw.welcomeSubtitle.trim().length > 0
      ? raw.welcomeSubtitle.trim().slice(0, 200)
      : DEFAULT_PORTAL_SETTINGS.welcomeSubtitle;

  const rawPhone =
    typeof raw.whatsappSupportNumber === 'string' ? raw.whatsappSupportNumber.trim() : '';
  const whatsappSupportNumber = /^\+?[0-9\s\-]{6,24}$/.test(rawPhone)
    ? rawPhone.slice(0, 32)
    : DEFAULT_PORTAL_SETTINGS.whatsappSupportNumber;

  const maintenanceMode = Boolean(raw.maintenanceMode);
  const maintenanceMessage =
    typeof raw.maintenanceMessage === 'string' && raw.maintenanceMessage.trim().length > 0
      ? raw.maintenanceMessage.trim().slice(0, 300)
      : DEFAULT_PORTAL_SETTINGS.maintenanceMessage;

  return {
    welcomeAnnouncement,
    welcomeSubtitle,
    whatsappSupportNumber,
    maintenanceMode,
    maintenanceMessage,
    updatedAt: raw.updatedAt ? normalizeTimestamp(raw.updatedAt) : undefined,
  };
}

export function mergeCatalogWithBuiltIn(
  builtInGames: GameMetadata[],
  cloudGames: GameMetadata[]
): GameMetadata[] {
  const seenIds = new Set(builtInGames.map((g) => g.id));
  const uniqueCloudGames = cloudGames.filter((g) => !seenIds.has(g.id));
  return [...builtInGames, ...uniqueCloudGames];
}

function isTransientConnectionError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('unavailable') ||
      msg.includes('client is offline') ||
      msg.includes('could not reach cloud firestore backend')
    );
  }
  return false;
}

export function subscribeToPublishedGames(
  onUpdate: (games: GameMetadata[]) => void
): () => void {
  // Emit cached games immediately for zero-latency and offline PWA readiness
  const cached = loadCachedCloudGames();
  if (cached.length > 0) {
    onUpdate(cached);
  }

  const publishedPath = 'published_games';
  const gamesQuery = query(
    collection(db, publishedPath),
    where('legalRightsVerified', '==', true)
  );

  let active = true;
  let unsubscribeSnapshot: (() => void) | null = null;
  let onlineListener: (() => void) | null = null;

  const startListener = () => {
    if (!active || unsubscribeSnapshot) return;

    unsubscribeSnapshot = onSnapshot(
      gamesQuery,
      async (snapshot) => {
        try {
          const resolvedDocs = await Promise.all(
            snapshot.docs.map(async (snap) => {
              const data = snap.data() as Record<string, unknown>;
              const id =
                typeof data.id === 'string' && /^[a-zA-Z0-9_\-]+$/.test(data.id)
                  ? data.id
                  : snap.id;
              const title =
                typeof data.title === 'string' ? data.title.trim().slice(0, 80) : '';
              const creatorStudio =
                typeof data.creatorStudio === 'string'
                  ? data.creatorStudio.trim().slice(0, 80)
                  : 'Verified Creator';
              const category = VALID_CATEGORIES.has(data.category as PublishedGameDoc['category'])
                ? (data.category as PublishedGameDoc['category'])
                : 'Arcade & Reflex';

              const legalRightsVerified = data.legalRightsVerified === true;
              if (!title || !legalRightsVerified) return null;

              const [bundleUrl, thumbUrl] = await Promise.all([
                resolveCloudStorageOrHttpsUrl(data.gameBundleUrl),
                resolveCloudStorageOrHttpsUrl(data.thumbnailUrl),
              ]);

              if (!bundleUrl) return null;

              const normalizedDoc: PublishedGameDoc = {
                id,
                title,
                creatorStudio,
                category,
                subtitle:
                  typeof data.subtitle === 'string' ? data.subtitle.trim().slice(0, 100) : undefined,
                description:
                  typeof data.description === 'string'
                    ? data.description.trim().slice(0, 500)
                    : undefined,
                thumbnailUrl: thumbUrl || '',
                gameBundleUrl: bundleUrl,
                isLandscapeOnly: data.isLandscapeOnly !== false,
                legalRightsVerified: true,
                accentColor: data.accentColor === 'crimson' ? 'crimson' : 'cyan',
                rating: typeof data.rating === 'number' ? data.rating : 4.8,
                activePlayersLabel:
                  typeof data.activePlayersLabel === 'string'
                    ? data.activePlayersLabel.trim().slice(0, 40)
                    : undefined,
                xpRewardMultiplier:
                  typeof data.xpRewardMultiplier === 'number' ? data.xpRewardMultiplier : 1.5,
                createdAt: normalizeTimestamp(data.createdAt),
              };

              return normalizedDoc;
            })
          );

          if (!active) return;

          const validDocs = resolvedDocs
            .filter((item): item is PublishedGameDoc => item !== null)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          saveCachedCloudGames(validDocs);
          onUpdate(validDocs.map(toCloudGameMetadata));
        } catch (error) {
          console.warn('Cloud game resolution fallback to local cache:', error);
          if (active) {
            onUpdate(loadCachedCloudGames());
          }
        }
      },
      (error) => {
        if (!isTransientConnectionError(error)) {
          try {
            handleFirestoreError(error, OperationType.LIST, publishedPath);
          } catch {
            // Fall through to localStorage fallback below
          }
        }
        if (active) {
          onUpdate(loadCachedCloudGames());
        }
      }
    );
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine && typeof window !== 'undefined') {
    onlineListener = () => {
      startListener();
    };
    window.addEventListener('online', onlineListener, { once: true });
  } else {
    startListener();
  }

  return () => {
    active = false;
    if (onlineListener && typeof window !== 'undefined') {
      window.removeEventListener('online', onlineListener);
      onlineListener = null;
    }
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  };
}

export function subscribeToPortalSettings(
  onUpdate: (settings: PortalRemoteSettings) => void
): () => void {
  onUpdate(loadCachedPortalSettings());

  const configPath = 'portal_settings/config';
  const configRef = doc(db, 'portal_settings', 'config');

  let active = true;
  let unsubscribeSnapshot: (() => void) | null = null;
  let onlineListener: (() => void) | null = null;

  const startListener = () => {
    if (!active || unsubscribeSnapshot) return;

    unsubscribeSnapshot = onSnapshot(
      configRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const normalized = normalizePortalSettings(snapshot.data() as Record<string, unknown>);
        saveCachedPortalSettings(normalized);
        onUpdate(normalized);
      },
      (error) => {
        if (!isTransientConnectionError(error)) {
          try {
            handleFirestoreError(error, OperationType.GET, configPath);
          } catch {
            // Fall through to localStorage fallback below
          }
        }
        if (active) {
          onUpdate(loadCachedPortalSettings());
        }
      }
    );
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine && typeof window !== 'undefined') {
    onlineListener = () => {
      startListener();
    };
    window.addEventListener('online', onlineListener, { once: true });
  } else {
    startListener();
  }

  return () => {
    active = false;
    if (onlineListener && typeof window !== 'undefined') {
      window.removeEventListener('online', onlineListener);
      onlineListener = null;
    }
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  };
}

export { DEFAULT_PORTAL_SETTINGS };
