import React from 'react';
import { Gamepad2, Maximize2, Play, Sparkles, Star, Users, Zap } from 'lucide-react';
import type { GameMetadata, PlayerProfile, PortalRemoteSettings } from '../types';
import { GameArtwork } from './GameArtwork';

interface HeroSpotlightProps {
  heroGame: GameMetadata;
  starterGame: GameMetadata;
  totalGamesCount: number;
  playableCount: number;
  profile: PlayerProfile;
  remoteSettings: PortalRemoteSettings;
  onLaunchGame: (game: GameMetadata) => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  heroGame,
  starterGame,
  totalGamesCount,
  playableCount,
  profile,
  remoteSettings,
  onLaunchGame,
}) => {
  return (
    <section id="spotlight" className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
      {/* Sleek Glowing Live Welcome Announcement Banner */}
      <div className="mb-4 rounded-2xl bg-gradient-to-r from-[#120B24] via-[#181036] to-[#120B24] border border-[#00F0FF]/30 px-4 sm:px-6 py-3.5 shadow-lg shadow-[#00F0FF]/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#FF1E42]/18 border border-[#FF1E42]/45 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-5 h-5 text-[#FF1E42]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-extrabold tracking-wide text-white truncate">
              {remoteSettings.welcomeAnnouncement || 'Welcome to Shadow Knight Game Zone'}
            </h2>
            <p className="text-xs text-slate-300 truncate">
              {remoteSettings.welcomeSubtitle} · Welcome back, {profile.gamerTag}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-300 font-mono-nums shrink-0">
          <span>
            <strong className="text-white">{playableCount}</strong> Playable Now
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            <strong className="text-[#00F0FF]">{totalGamesCount}</strong> Total Titles
          </span>
        </div>
      </div>

      {/* Flagship CHRONO SLAYER 3D Hero Spotlight Card */}
      <div className="rounded-2xl bg-[#120B24]/92 border border-[#FF1E42]/35 overflow-hidden shadow-2xl shadow-[#FF1E42]/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Narrative & Primary Action Column */}
          <div className="lg:col-span-6 p-5 sm:p-7 flex flex-col justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#00F0FF]/12 border border-[#00F0FF]/35 px-2.5 py-1 text-[#00F0FF] whitespace-nowrap">
                  <Maximize2 className="w-3.5 h-3.5" />
                  16:9 Landscape Mode
                </span>
                <span className="inline-flex items-center gap-1 text-amber-400 font-mono-nums">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {heroGame.rating.toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-300 font-mono-nums">
                  <Users className="w-3.5 h-3.5 text-[#00F0FF]" />
                  {heroGame.activePlayersLabel}
                </span>
              </div>

              <h1 className="mt-3 font-display text-2xl sm:text-4xl font-black tracking-tight text-white leading-[1.1] text-balance">
                CHRONO SLAYER <span className="text-[#FF1E42]">3D</span>
              </h1>

              <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                {heroGame.description}
              </p>

              <div className="mt-3 text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{heroGame.controlsSummary}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#00F0FF] font-mono-nums">
                  {heroGame.xpRewardMultiplier}x XP Bonus
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onLaunchGame(heroGame)}
                className="min-h-[46px] inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-7 py-2.5 font-display text-sm font-bold tracking-wide text-white shadow-lg shadow-[#FF1E42]/35 transition active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                PLAY NOW
              </button>

              <button
                type="button"
                onClick={() => onLaunchGame(starterGame)}
                className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[#00F0FF]/40 px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#00F0FF] transition whitespace-nowrap cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                Play {starterGame.title}
              </button>
            </div>
          </div>

          {/* Right 16:9 Visual Stage Showcase */}
          <div className="lg:col-span-6 relative min-h-[200px] sm:min-h-[260px] lg:min-h-[300px] bg-[#07070F]">
            <GameArtwork theme={heroGame.artworkTheme} title={heroGame.title} className="w-full h-full" />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07070F]/85 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#120B24] lg:via-[#120B24]/20 lg:to-transparent"
              aria-hidden="true"
            />
            <div className="absolute bottom-3.5 right-3.5 left-3.5 sm:left-auto flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-200">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#07070F]/88 border border-[#00F0FF]/40 px-3 py-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>3D WebGL Arena · Playable Now</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
