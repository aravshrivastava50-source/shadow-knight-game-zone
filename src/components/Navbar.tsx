import React from 'react';
import {
  Cloud,
  LogIn,
  MessageSquareHeart,
  ShieldCheck,
  Sword,
  Trophy,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { PlayerProfile } from '../types';
import { getLevelFromXp } from '../utils/playerStorage';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  profile: PlayerProfile;
  currentUser: User | null;
  isOwner: boolean;
  authBusy: boolean;
  onOpenLeaderboard: () => void;
  onOpenArmory: () => void;
  onOpenOwnerStudio: () => void;
  onOpenSupport: () => void;
  onSignInGoogle: () => void;
  onJumpToCatalog: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  currentUser,
  isOwner,
  authBusy,
  onOpenLeaderboard,
  onOpenArmory,
  onOpenOwnerStudio,
  onOpenSupport,
  onSignInGoogle,
  onJumpToCatalog,
}) => {
  const levelInfo = getLevelFromXp(profile.xp);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070F]/96">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-3 sm:gap-5 overflow-x-auto whitespace-nowrap no-scrollbar">
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
          <a href="#portal-banner" className="hover:text-white transition-colors whitespace-nowrap">
            Home
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
            onClick={onOpenArmory}
            className="hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            Armory
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
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono-nums px-2.5 py-1.5 rounded-lg bg-[#120B24]/80 border border-white/10 shrink-0">
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
            <span className="text-[#FF1E42]">{profile.streak}d</span>
          </div>

          <PWAInstallButton />

          <button
            type="button"
            onClick={onOpenArmory}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#120B24] hover:bg-[#1c1238] border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-300 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sword className="w-4 h-4" />
            <span>Armory</span>
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-4 py-2 text-sm font-extrabold text-white transition whitespace-nowrap shrink-0 cursor-pointer shadow-md shadow-[#FF1E42]/30"
          >
            <Trophy className="w-4 h-4" />
            <span>Rankings</span>
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/45 px-3.5 py-2 text-xs font-bold text-emerald-300 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>{profile.gamerTag}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={onSignInGoogle}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#00F0FF] hover:brightness-110 px-4 py-2 text-xs sm:text-sm font-extrabold text-[#07070F] transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{authBusy ? 'Signing In...' : 'Cloud Save'}</span>
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={onOpenOwnerStudio}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#00F0FF]/18 hover:bg-[#00F0FF]/28 border border-[#00F0FF]/60 px-4 py-2 text-sm font-bold text-[#00F0FF] transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Owner Studio</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSupport}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#120B24] hover:bg-[#1c1238] border border-[#00F0FF]/55 px-4 py-2 text-sm font-bold text-[#00F0FF] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquareHeart className="w-4 h-4" />
            <span>Support</span>
          </button>
        </div>
      </div>
    </header>
  );
};
