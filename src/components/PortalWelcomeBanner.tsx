import React from 'react';
import { Search, X } from 'lucide-react';
import type { GameCategory, PlayerProfile, PortalRemoteSettings } from '../types';
import { BrandLogo } from './BrandLogo';

export const PORTAL_CATEGORIES: GameCategory[] = [
  'All Games',
  '3D Action',
  'Racing & Drift',
  'Arcade & Reflex',
  '2-Player',
  'Community & Creator Games',
  'Coming Soon',
];

interface PortalWelcomeBannerProps {
  totalGamesCount: number;
  playableCount: number;
  profile: PlayerProfile;
  remoteSettings: PortalRemoteSettings;
  activeCategory: GameCategory;
  searchQuery: string;
  onSelectCategory: (category: GameCategory) => void;
  onSearchChange: (query: string) => void;
}

export const PortalWelcomeBanner: React.FC<PortalWelcomeBannerProps> = ({
  totalGamesCount,
  playableCount,
  profile,
  remoteSettings,
  activeCategory,
  searchQuery,
  onSelectCategory,
  onSearchChange,
}) => {
  return (
    <section id="portal-banner" className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-3">
      <div className="rounded-2xl bg-gradient-to-r from-[#120B24] via-[#170F2E] to-[#120B24] border border-[#00F0FF]/30 px-4 sm:px-6 py-4 shadow-xl shadow-[#00F0FF]/8">
        {/* Top Row: Brand Emblem + Welcome Headline + Instant Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="p-1 rounded-2xl bg-[#07070F]/90 border border-[#FF1E42]/45 shadow-lg shadow-[#FF1E42]/20 shrink-0">
              <BrandLogo className="w-14 h-14 sm:w-16 sm:h-16" />
            </div>

            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-white leading-tight text-balance">
                {remoteSettings.welcomeAnnouncement || 'Welcome to Shadow Knight Game Zone'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 truncate">
                {remoteSettings.welcomeSubtitle} · Welcome back, {profile.gamerTag}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-400 font-mono-nums">
                <span>
                  <strong className="text-[#00F0FF]">{playableCount}</strong> Playable Now
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-white">{totalGamesCount}</strong> Total Games
                </span>
                <span aria-hidden="true">·</span>
                <span>16:9 Instant Play</span>
              </div>
            </div>
          </div>

          {/* Instant Search Input */}
          <div className="relative w-full lg:w-80 shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search games, genres, studios..."
              aria-label="Search games"
              className="w-full min-h-[42px] rounded-xl bg-[#07070F]/90 border border-white/15 pl-10 pr-10 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Extra-Large Quick Category Filter Buttons */}
        <div
          role="tablist"
          aria-label="Game categories"
          className="mt-4 pt-3.5 border-t border-white/10 flex items-center gap-2.5 overflow-x-auto no-scrollbar"
        >
          {PORTAL_CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => onSelectCategory(category)}
                className={`min-h-[46px] px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                  isActive
                    ? 'bg-[#FF1E42] text-white shadow-md shadow-[#FF1E42]/35'
                    : 'bg-[#07070F]/85 text-slate-200 border border-white/15 hover:text-white hover:border-[#00F0FF]/55'
                }`}
              >
                {category === 'Community & Creator Games' ? 'Creator Games' : category}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
