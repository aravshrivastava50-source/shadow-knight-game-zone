import React from 'react';
import { MessageSquareHeart, Trophy } from 'lucide-react';
import type { PlayerProfile } from '../types';
import { getLevelFromXp } from '../utils/playerStorage';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  profile: PlayerProfile;
  onOpenLeaderboard: () => void;
  onOpenSupport: () => void;
  onJumpToCatalog: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  onOpenLeaderboard,
  onOpenSupport,
  onJumpToCatalog,
}) => {
  const levelInfo = getLevelFromXp(profile.xp);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070F]/92 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap no-scrollbar">
        {/* Brand Crest + Wordmark */}
        <a
          href="#top"
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] rounded-lg"
        >
          <BrandLogo className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
          <span className="font-display text-sm sm:text-base font-extrabold tracking-wide text-white">
            Shadow Knight <span className="text-[#FF1E42]">Game Zone</span>
          </span>
        </a>

        {/* Quick Nav Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-300 shrink-0"
        >
          <a href="#spotlight" className="hover:text-white transition-colors whitespace-nowrap">
            Spotlight
          </a>
          <button
            type="button"
            onClick={onJumpToCatalog}
            className="hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            Games
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            Rankings
          </button>
        </nav>

        {/* Spacer */}
        <div className="flex-1 min-w-[8px]" />

        {/* Horizontally Scrollable Player Progression + Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 text-xs text-slate-300 font-mono-nums px-2.5 py-1.5 rounded-lg bg-[#120B24]/80 border border-white/10 shrink-0">
            <span className="font-semibold text-white">Lv.{levelInfo.level}</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-[#00F0FF]">{profile.xp.toLocaleString()} XP</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-amber-400">{profile.coins.toLocaleString()} Coins</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-[#FF1E42]">{profile.streak}d Streak</span>
          </div>

          <PWAInstallButton />

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[#FF1E42] hover:bg-[#ff3355] px-3.5 py-2 text-xs font-semibold text-white transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Rankings</span>
          </button>

          <button
            type="button"
            onClick={onOpenSupport}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[#120B24] hover:bg-[#1c1238] border border-[#00F0FF]/45 px-3.5 py-2 text-xs font-semibold text-[#00F0FF] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquareHeart className="w-3.5 h-3.5" />
            <span>Support &amp; Contact With Us</span>
          </button>
        </div>
      </div>
    </header>
  );
};
