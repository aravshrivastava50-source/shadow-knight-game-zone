import React, { useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  Coins,
  Flame,
  Globe,
  LogIn,
  LogOut,
  Share2,
  Trophy,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { LeaderboardEntry, PlayerProfile } from '../types';
import { buildWhatsAppChallengeUrl, getLevelFromXp } from '../utils/playerStorage';

interface LeaderboardModalProps {
  isOpen: boolean;
  profile: PlayerProfile;
  localLeaderboard: LeaderboardEntry[];
  globalLeaderboard: LeaderboardEntry[];
  currentUser: User | null;
  authBusy: boolean;
  onClose: () => void;
  onUpdateGamerTag: (tag: string) => void;
  onSignInGoogle: () => void;
  onSignOut: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  profile,
  localLeaderboard,
  globalLeaderboard,
  currentUser,
  authBusy,
  onClose,
  onUpdateGamerTag,
  onSignInGoogle,
  onSignOut,
}) => {
  const [tagInput, setTagInput] = useState(profile.gamerTag);
  const [savedToast, setSavedToast] = useState(false);
  const [boardMode, setBoardMode] = useState<'global' | 'local'>('global');
  const [gameFilter, setGameFilter] = useState<string>('all');

  useEffect(() => {
    setTagInput(profile.gamerTag);
  }, [profile.gamerTag]);

  if (!isOpen) return null;

  const levelInfo = getLevelFromXp(profile.xp);
  const activeRows = (boardMode === 'global' && globalLeaderboard.length > 0
    ? globalLeaderboard
    : boardMode === 'local'
    ? localLeaderboard
    : globalLeaderboard
  ).filter((entry) => gameFilter === 'all' || entry.gameId === gameFilter);

  const topScore = activeRows[0]?.score ?? 0;

  const handleSaveTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tagInput.trim().slice(0, 18);
    if (!cleaned) return;
    onUpdateGamerTag(cleaned);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shadow Knight Rankings and Player Profile"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#120B24] border border-white/12 shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-[#120B24]/98 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-[#FF1E42]" />
            <h2 className="font-display text-lg font-bold text-white">
              Knight Rankings &amp; Cloud Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rankings"
            className="min-w-[46px] min-h-[46px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Google Cloud Account Sync Card */}
          <div className="rounded-xl bg-[#07070F]/90 border border-[#00F0FF]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/12 border border-[#00F0FF]/35 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-[#00F0FF]" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-white">
                  {currentUser
                    ? `Cloud Synced · ${currentUser.email || currentUser.displayName || 'Google Knight'}`
                    : 'Guest Mode (Local Device Only)'}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {currentUser
                    ? 'XP, Coins, Armory unlocks, and new high scores automatically post to the Global Leaderboard.'
                    : 'Sign in with Google to save XP & Armory across devices and post verified Global Rankings.'}
                </p>
              </div>
            </div>

            {currentUser ? (
              <button
                type="button"
                disabled={authBusy}
                onClick={onSignOut}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 px-4 py-2 text-xs font-bold text-slate-200 transition shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={onSignInGoogle}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#00F0FF] text-[#07070F] px-4 py-2 text-xs font-extrabold hover:brightness-110 transition shrink-0 cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>{authBusy ? 'Connecting...' : 'Sign In with Google'}</span>
              </button>
            )}
          </div>

          {/* Player Progression Summary */}
          <div className="rounded-xl bg-[#07070F]/85 border border-white/10 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400">
                  Knight Rank Level{' '}
                  <span className="font-mono-nums text-[#00F0FF]">{levelInfo.level}</span>
                </div>
                <form onSubmit={handleSaveTag} className="mt-1.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    maxLength={18}
                    aria-label="Gamer Tag"
                    className="min-h-[38px] rounded-lg bg-[#120B24] border border-white/15 px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-[#00F0FF] w-44"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-xl bg-white/12 hover:bg-white/20 px-5 py-2.5 text-sm font-bold text-white transition cursor-pointer"
                  >
                    {savedToast ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Check className="w-4 h-4" /> Saved
                      </span>
                    ) : (
                      'Update Tag'
                    )}
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center sm:text-right">
                <div>
                  <div className="text-[11px] text-slate-400">Total XP</div>
                  <div className="font-mono-nums text-base font-bold text-[#00F0FF]">
                    {profile.xp.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Coins</div>
                  <div className="font-mono-nums text-base font-bold text-amber-400 inline-flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    {profile.coins.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Streak</div>
                  <div className="font-mono-nums text-base font-bold text-[#FF1E42] inline-flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    {profile.streak}d
                  </div>
                </div>
              </div>
            </div>

            {/* Level XP Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-nums">
                <span>Level {levelInfo.level} Progress</span>
                <span>
                  {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-[#120B24] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF1E42] to-[#00F0FF] transition-all"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBoardMode('global')}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    boardMode === 'global'
                      ? 'bg-[#00F0FF] text-[#07070F]'
                      : 'bg-white/8 text-slate-300 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Global Cloud ({globalLeaderboard.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBoardMode('local')}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    boardMode === 'local'
                      ? 'bg-[#FF1E42] text-white'
                      : 'bg-white/8 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>My Device ({localLeaderboard.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <select
                  aria-label="Filter leaderboard by game"
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className="min-h-[36px] rounded-lg bg-[#07070F] border border-white/15 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00F0FF]"
                >
                  <option value="all">All Games</option>
                  <option value="chrono-slayer-3d">Chrono Slayer 3D</option>
                  <option value="shadow-reflex-arena">Shadow Reflex Arena</option>
                </select>

                <a
                  href={buildWhatsAppChallengeUrl(
                    'Chrono Slayer 3D',
                    profile.highScores['chrono-slayer-3d'] ||
                      profile.highScores['shadow-reflex-arena'] ||
                      topScore
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Challenge</span>
                </a>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#07070F]/70">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5">Rank</th>
                    <th className="py-2.5 px-3.5">Knight</th>
                    <th className="py-2.5 px-3.5">Game</th>
                    <th className="py-2.5 px-3.5 text-right">Combo</th>
                    <th className="py-2.5 px-3.5 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {activeRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-xs text-slate-400">
                        {boardMode === 'global'
                          ? 'No cloud scores posted yet for this filter. Sign in with Google and complete a run to claim #1!'
                          : 'No runs recorded on this device yet.'}
                      </td>
                    </tr>
                  ) : (
                    activeRows.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className={entry.isCurrentPlayer ? 'bg-[#00F0FF]/8' : ''}
                      >
                        <td className="py-2.5 px-3.5 font-mono-nums font-bold text-slate-300">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-white">
                          {entry.gamerTag}
                          {entry.isCurrentPlayer && (
                            <span className="ml-2 text-[10px] text-[#00F0FF]">(You)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-400">{entry.gameTitle}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono-nums text-[#00F0FF]">
                          {entry.maxCombo}x
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono-nums font-bold text-white">
                          {entry.score.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-500">
            © 2026 Shadow Knight Game Zone. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

