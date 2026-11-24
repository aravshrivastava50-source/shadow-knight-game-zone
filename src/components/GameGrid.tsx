import React, { useMemo, useState } from 'react';
import { Gamepad2, Play, Search, ShieldCheck, Star, Trophy, Users, X } from 'lucide-react';
import { sanitizeHttpsUrl } from '../services/cloudCatalog';
import type { GameCategory, GameMetadata, PlayerProfile } from '../types';
import { GameArtwork } from './GameArtwork';

const CATEGORIES: GameCategory[] = [
  'All Games',
  'Community & Creator Games',
  '3D Action',
  'Racing & Drift',
  'Arcade & Reflex',
  '2-Player',
  'Coming Soon',
];

interface GameGridProps {
  games: GameMetadata[];
  profile: PlayerProfile;
  onSelectGame: (game: GameMetadata) => void;
}

export const GameGrid: React.FC<GameGridProps> = ({ games, profile, onSelectGame }) => {
  const [activeCategory, setActiveCategory] = useState<GameCategory>('All Games');
  const [searchQuery, setSearchQuery] = useState('');
  const [brokenThumbIds, setBrokenThumbIds] = useState<Record<string, boolean>>({});

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return games.filter((game) => {
      const matchesCategory =
        activeCategory === 'All Games'
          ? true
          : activeCategory === 'Community & Creator Games'
          ? Boolean(game.isCommunityGame)
          : activeCategory === 'Coming Soon'
          ? game.status === 'coming-soon'
          : game.category === activeCategory;

      if (!matchesCategory) return false;
      if (!q) return true;

      return (
        game.title.toLowerCase().includes(q) ||
        game.subtitle.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q) ||
        (game.creatorStudio?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [activeCategory, games, searchQuery]);

  return (
    <section id="games-catalog" className="mx-auto max-w-7xl px-4 sm:px-6 pt-2 pb-8">
      {/* Toolbar: Category Filter Tabs + Instant Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 pb-4 border-b border-white/10">
        <div
          role="tablist"
          aria-label="Game categories"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar"
        >
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                  isActive
                    ? 'bg-[#FF1E42] text-white shadow-sm shadow-[#FF1E42]/30'
                    : 'bg-[#120B24] text-slate-300 border border-white/10 hover:text-white hover:border-white/25'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Instant Search Input */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games or genres..."
            aria-label="Search games"
            className="w-full min-h-[40px] rounded-xl bg-[#120B24] border border-white/12 pl-10 pr-9 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF] transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg sm:text-xl font-bold text-white">
          {activeCategory === 'All Games' ? 'Featured Arcade & 3D Library' : activeCategory}
        </h2>
        <span className="text-xs text-slate-400 font-mono-nums">
          {filteredGames.length} {filteredGames.length === 1 ? 'title' : 'titles'}
        </span>
      </div>

      {/* Multi-Game Showcase Grid */}
      {filteredGames.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-[#120B24]/70 border border-white/10 p-10 text-center">
          <Gamepad2 className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="mt-3 font-display text-base font-bold text-white">No matching games</h3>
          <p className="mt-1 text-sm text-slate-400">
            Try clearing your search query or switching to All Games.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('All Games');
              setSearchQuery('');
            }}
            className="mt-4 min-h-[40px] rounded-lg bg-[#00F0FF] text-[#07070F] px-4 py-2 text-xs font-bold hover:brightness-110 transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGames.map((game) => {
            const best = profile.highScores[game.id] ?? 0;
            const isPlayable = game.status === 'playable';
            const isPreRegistered = profile.preRegisteredIds.includes(game.id);
            const safeThumbUrl = !brokenThumbIds[game.id]
              ? sanitizeHttpsUrl(game.thumbnailUrl)
              : null;
            const neonBorder = isPlayable
              ? game.accentColor === 'crimson'
                ? 'border-[#FF1E42]/45 hover:border-[#FF1E42] shadow-lg shadow-[#FF1E42]/10'
                : 'border-[#00F0FF]/45 hover:border-[#00F0FF] shadow-lg shadow-[#00F0FF]/10'
              : 'border-white/12 hover:border-[#00F0FF]/45';

            return (
              <article
                key={game.id}
                className={`group rounded-2xl bg-[#120B24]/90 border ${neonBorder} overflow-hidden flex flex-col transition duration-200`}
              >
                {/* 16:9 Artwork Frame */}
                <button
                  type="button"
                  onClick={() => onSelectGame(game)}
                  className="relative aspect-video w-full overflow-hidden bg-[#07070F] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]"
                >
                  {safeThumbUrl ? (
                    <img
                      src={safeThumbUrl}
                      alt={game.title}
                      loading="lazy"
                      onError={() =>
                        setBrokenThumbIds((prev) => ({ ...prev, [game.id]: true }))
                      }
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <GameArtwork
                      theme={game.artworkTheme}
                      title={game.title}
                      className="transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07070F]/90 via-transparent to-transparent" />

                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${
                          isPlayable
                            ? 'bg-[#00F0FF] text-[#07070F] shadow-sm shadow-[#00F0FF]/50'
                            : isPreRegistered
                            ? 'bg-emerald-500/90 text-white'
                            : 'bg-[#07070F]/85 border border-amber-400/50 text-amber-300'
                        }`}
                      >
                        {isPlayable
                          ? 'Playable Now'
                          : isPreRegistered
                          ? 'Pre-Registered'
                          : 'Coming Soon'}
                      </span>

                      {game.isCommunityGame && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#120B24]/90 border border-[#00F0FF]/40 px-2 py-0.5 text-[10px] font-semibold text-[#00F0FF]">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Creator</span>
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-md bg-[#07070F]/85 border border-white/15 px-2 py-0.5 text-[11px] font-mono-nums text-amber-400 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {game.rating.toFixed(1)}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-200 truncate">
                      {game.category} · {game.orientation}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono-nums text-[#00F0FF] shrink-0">
                      <Users className="w-3.5 h-3.5" />
                      {game.activePlayersLabel}
                    </span>
                  </div>
                </button>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base sm:text-lg font-bold text-white leading-snug">
                        {game.title}
                      </h3>
                      {best > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono-nums text-amber-400 shrink-0">
                          <Trophy className="w-3.5 h-3.5" />
                          {best.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{game.subtitle}</p>
                    <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-2">
                      {game.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/8">
                    <span className="text-[11px] text-slate-400 truncate">{game.players}</span>
                    <button
                      type="button"
                      onClick={() => onSelectGame(game)}
                      className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                        isPlayable
                          ? 'bg-[#FF1E42] hover:bg-[#ff3355] text-white shadow-sm shadow-[#FF1E42]/35'
                          : 'bg-white/8 hover:bg-white/15 text-[#00F0FF] border border-[#00F0FF]/35'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isPlayable ? 'Play Now' : 'Preview'}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
