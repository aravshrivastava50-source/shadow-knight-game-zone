import React, { useState } from 'react';
import { Check, Coins, Flame, Share2, Trophy, X } from 'lucide-react';
import type { LeaderboardEntry, PlayerProfile } from '../types';
import { buildWhatsAppChallengeUrl, getLevelFromXp } from '../utils/playerStorage';

interface LeaderboardModalProps {
  isOpen: boolean;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  onClose: () => void;
  onUpdateGamerTag: (tag: string) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  profile,
  leaderboard,
  onClose,
  onUpdateGamerTag,
}) => {
  const [tagInput, setTagInput] = useState(profile.gamerTag);
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const levelInfo = getLevelFromXp(profile.xp);
  const topScore = leaderboard[0]?.score ?? 0;

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shadow Knight Rankings and Player Profile"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#120B24] border border-white/12 shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-[#120B24]/95 border-b border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-[#FF1E42]" />
            <h2 className="font-display text-lg font-bold text-white">
              Knight Rankings &amp; Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rankings"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Player Progression Summary */}
          <div className="rounded-xl bg-[#07070F]/85 border border-white/10 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400">
                  Knight Rank Level <span className="font-mono-nums text-[#00F0FF]">{levelInfo.level}</span>
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
                    className="min-h-[38px] rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    {savedToast ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Saved
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
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-display text-sm font-bold text-white">
                Top Arena Scores
              </h3>
              <a
                href={buildWhatsAppChallengeUrl(
                  'Shadow Reflex Arena',
                  profile.highScores['shadow-reflex-arena'] || topScore
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                Challenge Friend on WhatsApp
              </a>
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
                  {leaderboard.map((entry, idx) => (
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
                  ))}
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
