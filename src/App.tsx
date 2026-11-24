import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, ShieldAlert, Smartphone, Trophy, Wrench, Zap } from 'lucide-react';
import { BrandedLoader } from './components/BrandedLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameGrid } from './components/GameGrid';
import { GameStageModal } from './components/GameStageModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { PortalWelcomeBanner } from './components/PortalWelcomeBanner';
import { SupportContactModal } from './components/SupportContactModal';
import { buildSupportWhatsAppUrl } from './config/contact';
import {
  GAMES_REGISTRY,
  getPlayableStarterGame,
} from './games/gamesRegistry';
import {
  loadCachedCloudGames,
  loadCachedPortalSettings,
  mergeCatalogWithBuiltIn,
  subscribeToPortalSettings,
  subscribeToPublishedGames,
} from './services/cloudCatalog';
import type {
  GameCategory,
  GameMetadata,
  GameSessionResult,
  LeaderboardEntry,
  PlayerProfile,
  PortalRemoteSettings,
} from './types';
import { checkDomainAuthorization } from './utils/domainGuard';
import {
  loadLeaderboard,
  loadPlayerProfile,
  recordGameSession,
  savePlayerProfile,
} from './utils/playerStorage';

function PortalShell() {
  const domainCheck = checkDomainAuthorization();

  const [showLoader, setShowLoader] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [cloudGames, setCloudGames] = useState<GameMetadata[]>(() => loadCachedCloudGames());
  const [remoteSettings, setRemoteSettings] = useState<PortalRemoteSettings>(() =>
    loadCachedPortalSettings()
  );
  const [activeCategory, setActiveCategory] = useState<GameCategory>('All Games');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGame, setActiveGame] = useState<GameMetadata | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowLoader(false), 550);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubGames = subscribeToPublishedGames((liveGames) => {
      setCloudGames(liveGames);
    });
    const unsubSettings = subscribeToPortalSettings((liveSettings) => {
      setRemoteSettings(liveSettings);
    });
    return () => {
      unsubGames();
      unsubSettings();
    };
  }, []);

  const mergedCatalog = useMemo(
    () => mergeCatalogWithBuiltIn(GAMES_REGISTRY, cloudGames),
    [cloudGames]
  );

  const handleSessionComplete = useCallback((result: GameSessionResult) => {
    setProfile((prev) => {
      const updated = recordGameSession(prev, result);
      setLeaderboard(updated.leaderboard);
      return updated.profile;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setProfile((prev) => {
      const next = { ...prev, soundMuted: !prev.soundMuted };
      savePlayerProfile(next);
      return next;
    });
  }, []);

  const handlePreRegister = useCallback((gameId: string) => {
    setProfile((prev) => {
      if (prev.preRegisteredIds.includes(gameId)) return prev;
      const next: PlayerProfile = {
        ...prev,
        xp: prev.xp + 25,
        coins: prev.coins + 15,
        preRegisteredIds: [...prev.preRegisteredIds, gameId],
      };
      savePlayerProfile(next);
      return next;
    });
  }, []);

  const handleUpdateGamerTag = useCallback((gamerTag: string) => {
    setProfile((prev) => {
      const next = { ...prev, gamerTag };
      savePlayerProfile(next);
      return next;
    });
  }, []);

  const handleJumpToCatalog = useCallback(() => {
    document.getElementById('games-catalog')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleResetFilters = useCallback(() => {
    setActiveCategory('All Games');
    setSearchQuery('');
  }, []);

  if (!domainCheck.authorized) {
    return (
      <div className="min-h-screen bg-[#07070F] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl bg-[#120B24] border border-[#FF1E42]/50 p-7 text-center shadow-2xl">
          <ShieldAlert className="w-12 h-12 text-[#FF1E42] mx-auto" />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-white">
            Unauthorized Domain Blocked
          </h1>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            This portal is protected by Shadow Knight Game Zone Anti-Theft Domain Lock. Running an
            unauthorized mirror on{' '}
            <span className="font-mono-nums text-[#FF1E42]">{domainCheck.hostname}</span> is
            prohibited.
          </p>
          <p className="mt-5 text-xs text-slate-400">
            © 2026 Shadow Knight Game Zone. All Rights Reserved.
          </p>
        </div>
      </div>
    );
  }

  if (remoteSettings.maintenanceMode) {
    return (
      <div className="min-h-screen bg-[#07070F] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl bg-[#120B24] border border-[#00F0FF]/45 p-7 text-center shadow-2xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FF1E42]/15 border border-[#FF1E42]/45 flex items-center justify-center">
            <Wrench className="w-7 h-7 text-[#FF1E42]" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-extrabold text-white">
            Scheduled Arena Maintenance
          </h1>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            {remoteSettings.maintenanceMessage}
          </p>
          <div className="mt-5 flex justify-center">
            <a
              href={buildSupportWhatsAppUrl(
                'Hello Shadow Knight Game Zone Team, checking status during arena maintenance.',
                remoteSettings.whatsappSupportNumber
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-5 py-2 text-xs font-bold text-white transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contact Support ({remoteSettings.whatsappSupportNumber})</span>
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-400">
            © 2026 Shadow Knight Game Zone. All Rights Reserved.
          </p>
        </div>
      </div>
    );
  }

  const starterGame = getPlayableStarterGame();
  const playableCount = mergedCatalog.filter((g) => g.status === 'playable').length;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#07070F] text-slate-100">
      <BrandedLoader visible={showLoader} />

      <Navbar
        profile={profile}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        onOpenSupport={() => setSupportOpen(true)}
        onJumpToCatalog={handleJumpToCatalog}
      />

      <main className="flex-1">
        <PortalWelcomeBanner
          totalGamesCount={mergedCatalog.length}
          playableCount={playableCount}
          profile={profile}
          remoteSettings={remoteSettings}
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          onSelectCategory={setActiveCategory}
          onSearchChange={setSearchQuery}
        />

        <GameGrid
          games={mergedCatalog}
          profile={profile}
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          onResetFilters={handleResetFilters}
          onSelectGame={(game) => setActiveGame(game)}
        />

        {/* Portal Capabilities & Architecture Strip */}
        <section
          id="about-portal"
          className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12 border-t border-white/10 mt-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-[#120B24]/70 border border-white/10 p-5">
              <Smartphone className="w-5 h-5 text-[#00F0FF]" />
              <h3 className="mt-3 font-display text-sm font-bold text-white">
                16:9 Force-Landscape Stage
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Auto-fullscreen, native orientation lock, and instant Force-Landscape fallback keep
                every 3D &amp; arcade game wide on mobile and desktop.
              </p>
            </div>

            <div className="rounded-2xl bg-[#120B24]/70 border border-white/10 p-5">
              <Zap className="w-5 h-5 text-[#FF1E42]" />
              <h3 className="mt-3 font-display text-sm font-bold text-white">
                Offline-Ready PWA
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Install Shadow Knight Game Zone directly to your home screen for instant launch and
                Workbox offline arcade caching.
              </p>
            </div>

            <div className="rounded-2xl bg-[#120B24]/70 border border-white/10 p-5">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="mt-3 font-display text-sm font-bold text-white">
                XP, Coins &amp; Daily Streaks
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Earn XP, Coins, and Streak bonuses on every run, then challenge friends directly on
                WhatsApp to beat your high score.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#07070F] py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="font-display font-semibold text-slate-200">
            Shadow Knight Game Zone
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="text-[#00F0FF] hover:underline cursor-pointer"
            >
              Support &amp; Contact With Us
            </button>
            <span>© 2026 Shadow Knight Game Zone. All Rights Reserved.</span>
          </div>
        </div>
      </footer>

      <GameStageModal
        game={activeGame}
        starterGame={starterGame}
        profile={profile}
        onClose={() => setActiveGame(null)}
        onSwitchGame={(nextGame) => setActiveGame(nextGame)}
        onToggleMute={handleToggleMute}
        onSessionComplete={handleSessionComplete}
        onPreRegister={handlePreRegister}
      />

      <LeaderboardModal
        isOpen={leaderboardOpen}
        profile={profile}
        leaderboard={leaderboard}
        onClose={() => setLeaderboardOpen(false)}
        onUpdateGamerTag={handleUpdateGamerTag}
      />

      <SupportContactModal
        isOpen={supportOpen}
        whatsappSupportNumber={remoteSettings.whatsappSupportNumber}
        onClose={() => setSupportOpen(false)}
      />

      <OfflineBanner />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PortalShell />
    </ErrorBoundary>
  );
}
