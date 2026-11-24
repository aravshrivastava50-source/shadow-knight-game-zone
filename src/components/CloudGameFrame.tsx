import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Home,
  RotateCcw,
  Share2,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { sanitizeHttpsUrl } from '../services/cloudCatalog';
import type { GameSessionResult } from '../types';
import { buildWhatsAppChallengeUrl } from '../utils/playerStorage';

interface CloudGameFrameProps {
  gameId: string;
  gameTitle: string;
  creatorStudio?: string;
  gameBundleUrl: string;
  xpRewardMultiplier: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onSessionComplete: (result: GameSessionResult) => void;
  onExit: () => void;
}

export const CloudGameFrame: React.FC<CloudGameFrameProps> = ({
  gameId,
  gameTitle,
  creatorStudio,
  gameBundleUrl,
  xpRewardMultiplier,
  isMuted,
  onToggleMute,
  onSessionComplete,
  onExit,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const reportedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reportedScore, setReportedScore] = useState(0);
  const [reportedMaxCombo, setReportedMaxCombo] = useState(1);
  const [sessionSummary, setSessionSummary] = useState<{
    score: number;
    xpEarned: number;
    coinsEarned: number;
  } | null>(null);

  const safeBundleUrl = sanitizeHttpsUrl(gameBundleUrl);

  const commitSessionRewards = useCallback(
    (showSummaryModal: boolean) => {
      if (reportedRef.current) return;
      const seconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
      if (seconds < 3 && reportedScore <= 0 && !showSummaryModal) {
        return;
      }

      reportedRef.current = true;
      const computedScore =
        reportedScore > 0 ? reportedScore : Math.max(50, seconds * 12);
      const baseXp = Math.max(15, Math.min(250, Math.round(seconds * 1.1 + computedScore * 0.04)));
      const xpEarned = Math.round(baseXp * Math.max(0.5, xpRewardMultiplier));
      const coinsEarned = Math.max(10, Math.round(xpEarned * 0.6));

      onSessionComplete({
        gameId,
        gameTitle,
        score: computedScore,
        maxCombo: Math.max(1, reportedMaxCombo),
        accuracy: 100,
        xpEarned,
        coinsEarned,
      });

      if (showSummaryModal) {
        setSessionSummary({ score: computedScore, xpEarned, coinsEarned });
      }
    },
    [
      gameId,
      gameTitle,
      onSessionComplete,
      reportedMaxCombo,
      reportedScore,
      xpRewardMultiplier,
    ]
  );

  useEffect(() => {
    startTimeRef.current = Date.now();
    reportedRef.current = false;
    setElapsedSeconds(0);
    setSessionSummary(null);

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(interval);
      // Award accrued XP automatically when player exits after >= 3s of gameplay
      commitSessionRewards(false);
    };
  }, [commitSessionRewards, gameId, reloadNonce]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }
      const payload = event.data as
        | { type?: unknown; score?: unknown; maxCombo?: unknown }
        | null
        | undefined;
      if (!payload || typeof payload !== 'object' || payload.type !== 'SKGZ_SCORE') {
        return;
      }
      const rawScore = Number(payload.score);
      if (Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 10_000_000) {
        setReportedScore((prev) => Math.max(prev, Math.round(rawScore)));
      }
      const rawCombo = Number(payload.maxCombo);
      if (Number.isFinite(rawCombo) && rawCombo >= 1 && rawCombo <= 9999) {
        setReportedMaxCombo((prev) => Math.max(prev, Math.round(rawCombo)));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!safeBundleUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#07070F] p-6 text-center">
        <div className="max-w-md rounded-2xl bg-[#120B24] border border-[#FF1E42]/45 p-6">
          <AlertTriangle className="w-10 h-10 text-[#FF1E42] mx-auto" />
          <h3 className="mt-3 font-display text-base font-bold text-white">
            Invalid Game Bundle URL
          </h3>
          <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
            This creator bundle could not be verified as a secure HTTPS game package.
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#FF1E42] px-4 py-2 text-xs font-bold text-white cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    );
  }

  const handleReplay = () => {
    setIsLoaded(false);
    setLoadFailed(false);
    setReportedScore(0);
    setReportedMaxCombo(1);
    setReloadNonce((n) => n + 1);
  };

  return (
    <div className="relative w-full h-full bg-[#07070F] overflow-hidden select-none">
      {/* Sandboxed External Cloud Game Bundle */}
      <iframe
        key={`${gameId}-${reloadNonce}`}
        ref={iframeRef}
        src={safeBundleUrl}
        title={`${gameTitle} — Shadow Knight Game Zone`}
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        allow="fullscreen; gamepad"
        referrerPolicy="no-referrer"
        onLoad={() => {
          setIsLoaded(true);
          setLoadFailed(false);
        }}
        onError={() => {
          setIsLoaded(true);
          setLoadFailed(true);
        }}
        className="w-full h-full border-0 bg-[#07070F]"
      />

      {/* Lightweight Top-Right Cloud Session HUD */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-10">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-[#07070F]/85 border border-[#00F0FF]/35 px-2.5 py-1 text-[11px] text-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span className="font-semibold truncate max-w-[160px]">
            {creatorStudio || 'Verified Creator'}
          </span>
          <span className="text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="font-mono-nums text-amber-400">{elapsedSeconds}s</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => commitSessionRewards(true)}
            className="min-h-[32px] inline-flex items-center gap-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#33f3ff] px-2.5 py-1 text-[11px] font-bold text-[#07070F] transition cursor-pointer"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Claim XP</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute portal audio' : 'Mute portal audio'}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg bg-[#07070F]/85 border border-white/15 text-slate-200 hover:border-[#00F0FF] transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Subtle Copyright Footer */}
      <div className="pointer-events-none absolute bottom-1.5 right-2.5 z-10 text-[10px] text-slate-400/80 bg-[#07070F]/70 px-2 py-0.5 rounded">
        © 2026 Shadow Knight Game Zone. All Rights Reserved.
      </div>

      {/* Loading Overlay */}
      {!isLoaded && !loadFailed && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#07070F]/95 p-6 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#00F0FF]/30 border-t-[#00F0FF] animate-spin" />
          <h3 className="mt-4 font-display text-base font-bold text-white">
            Loading {gameTitle}...
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Initializing sandboxed 16:9 Landscape Cloud Stage
          </p>
        </div>
      )}

      {/* Load Failure Fallback */}
      {loadFailed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07070F]/95 p-6 text-center">
          <div className="max-w-md rounded-2xl bg-[#120B24] border border-[#FF1E42]/45 p-6">
            <AlertTriangle className="w-9 h-9 text-[#FF1E42] mx-auto" />
            <h3 className="mt-3 font-display text-base font-bold text-white">
              Cloud Bundle Unavailable
            </h3>
            <p className="mt-1.5 text-xs text-slate-300">
              Unable to reach the remote game bundle right now.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={handleReplay}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#FF1E42] px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Session Complete & XP Claim Summary */}
      {sessionSummary && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/92 p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#120B24] border border-[#00F0FF]/40 p-6 text-center shadow-2xl">
            <Award className="w-10 h-10 text-[#00F0FF] mx-auto" />
            <h3 className="mt-2 font-display text-xl font-black text-white">
              Session Rewards Synced!
            </h3>
            <p className="mt-1 text-xs text-slate-300">{gameTitle}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#07070F] border border-white/10 p-3">
              <div>
                <div className="text-[11px] text-slate-400">Score</div>
                <div className="font-mono-nums text-sm font-bold text-white">
                  {sessionSummary.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">XP Gained</div>
                <div className="font-mono-nums text-sm font-bold text-emerald-400">
                  +{sessionSummary.xpEarned}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Coins</div>
                <div className="font-mono-nums text-sm font-bold text-amber-400">
                  +{sessionSummary.coinsEarned}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleReplay}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-3 py-2 font-display text-xs font-bold text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Play Again</span>
              </button>

              <a
                href={buildWhatsAppChallengeUrl(gameTitle, sessionSummary.score)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-3 py-2 text-xs font-semibold text-white"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Challenge Friend</span>
              </a>

              <button
                type="button"
                onClick={onExit}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#07070F] border border-white/20 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
