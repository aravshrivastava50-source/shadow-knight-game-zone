import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Maximize2,
  Minimize2,
  RotateCw,
  Share2,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { GameMetadata, GameSessionResult, PlayerProfile } from '../types';
import {
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  isFullscreenActive,
  isLandscapeViewport,
  isMobilePortraitViewport,
  triggerViewportResize,
} from '../utils/landscapeManager';
import { buildWhatsAppChallengeUrl } from '../utils/playerStorage';
import { CloudGameFrame } from './CloudGameFrame';
import { GameArtwork } from './GameArtwork';

interface GameStageModalProps {
  game: GameMetadata | null;
  starterGame: GameMetadata;
  profile: PlayerProfile;
  onClose: () => void;
  onSwitchGame: (game: GameMetadata) => void;
  onToggleMute: () => void;
  onSessionComplete: (result: GameSessionResult) => void;
  onPreRegister: (gameId: string) => void;
}

export const GameStageModal: React.FC<GameStageModalProps> = ({
  game,
  starterGame,
  profile,
  onClose,
  onSwitchGame,
  onToggleMute,
  onSessionComplete,
  onPreRegister,
}) => {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [bypassRotatePrompt, setBypassRotatePrompt] = useState(false);
  const [forceLandscapeCSS, setForceLandscapeCSS] = useState(false);

  useEffect(() => {
    if (!game) return;

    setBypassRotatePrompt(false);
    setForceLandscapeCSS(false);

    const landscapeMedia = window.matchMedia('(orientation: landscape)');

    const syncViewportState = () => {
      const landscapeNow = landscapeMedia.matches || isLandscapeViewport();
      const portraitMobileNow = !landscapeNow && isMobilePortraitViewport();

      setIsPortraitMobile(portraitMobileNow);
      setIsFullscreen(isFullscreenActive());

      // Automatically dismiss Rotate overlay & CSS rotation if user physically rotates phone to landscape
      if (landscapeNow) {
        setBypassRotatePrompt(true);
        setForceLandscapeCSS(false);
      }
      triggerViewportResize();
    };

    syncViewportState();
    // Trigger document.documentElement.requestFullscreen() + screen.orientation.lock('landscape') on launch
    void enterLandscapeFullscreen(document.documentElement).then((res) => {
      setIsFullscreen(isFullscreenActive());
      if (res.orientationLocked) {
        setBypassRotatePrompt(true);
      }
      syncViewportState();
    });

    const handleMediaChange = () => syncViewportState();
    landscapeMedia.addEventListener?.('change', handleMediaChange);
    window.addEventListener('resize', syncViewportState);
    window.addEventListener('orientationchange', syncViewportState);
    document.addEventListener('fullscreenchange', syncViewportState);

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isFullscreenActive()) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      landscapeMedia.removeEventListener?.('change', handleMediaChange);
      window.removeEventListener('resize', syncViewportState);
      window.removeEventListener('orientationchange', syncViewportState);
      document.removeEventListener('fullscreenchange', syncViewportState);
      window.removeEventListener('keydown', handleEsc);
      void exitLandscapeFullscreen();
    };
  }, [game, onClose]);

  useEffect(() => {
    if (!game) return;
    triggerViewportResize();
  }, [forceLandscapeCSS, game]);

  if (!game) return null;

  const ActiveGameComponent = game.component;
  const bestScore = profile.highScores[game.id] ?? 0;
  const isPreRegistered = profile.preRegisteredIds.includes(game.id);
  const applyCssRotation = forceLandscapeCSS && isPortraitMobile;

  const handleToggleFullscreen = async () => {
    if (isFullscreenActive()) {
      await exitLandscapeFullscreen();
    } else {
      await enterLandscapeFullscreen(document.documentElement);
    }
    setIsFullscreen(isFullscreenActive());
    triggerViewportResize();
  };

  const handleEnableLandscape = async () => {
    const res = await enterLandscapeFullscreen(document.documentElement);
    setIsFullscreen(isFullscreenActive());
    // If browser blocked native orientation lock or phone stays portrait, engage rock-solid CSS Force-Landscape
    if (!res.orientationLocked && !isLandscapeViewport()) {
      setForceLandscapeCSS(true);
    }
    setBypassRotatePrompt(true);
    triggerViewportResize();
  };

  const handleExitToHome = () => {
    setForceLandscapeCSS(false);
    void exitLandscapeFullscreen();
    onClose();
  };

  return (
    <div
      ref={stageContainerRef}
      onContextMenu={(e) => e.preventDefault()}
      style={
        applyCssRotation
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vh',
              height: '100vw',
              transform: 'rotate(90deg) translateY(-100%)',
              transformOrigin: 'top left',
            }
          : undefined
      }
      className={`${
        applyCssRotation ? 'z-50' : 'fixed inset-0 z-50'
      } flex flex-col bg-[#07070F] text-white select-none`}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.title} Stage`}
    >
      {/* Top Stage Bar with Visible Top-Left "Exit to Home" */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 bg-[#120B24]/95 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleExitToHome}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[#FF1E42]/20 border border-[#FF1E42]/50 px-3 py-1.5 text-xs font-bold text-white hover:bg-[#FF1E42] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit to Home</span>
          </button>

          <span className="font-display text-xs sm:text-sm font-bold text-white truncate">
            {game.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden lg:inline text-[11px] text-slate-400 whitespace-nowrap mr-1">
            © 2026 Shadow Knight Game Zone. All Rights Reserved.
          </span>

          {isPortraitMobile && (
            <button
              type="button"
              onClick={() => {
                setForceLandscapeCSS((prev) => !prev);
                setBypassRotatePrompt(true);
              }}
              className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition cursor-pointer ${
                applyCssRotation
                  ? 'bg-[#00F0FF] border-[#00F0FF] text-[#07070F]'
                  : 'bg-white/5 border-white/15 text-[#00F0FF] hover:border-[#00F0FF]'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{applyCssRotation ? 'Portrait' : 'Force Landscape'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleToggleFullscreen()}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 text-xs font-medium text-slate-200 hover:border-[#00F0FF]/50 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Windowed' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Main 16:9 Stage Viewport */}
      <div className="relative flex-1 flex items-center justify-center bg-[#07070F] p-1 sm:p-3 overflow-hidden">
        <div
          className={`relative ${
            applyCssRotation ? 'w-full h-full' : 'w-full max-w-6xl aspect-video max-h-full'
          } rounded-xl overflow-hidden border border-white/10 bg-[#0A0817] shadow-2xl`}
        >
          {ActiveGameComponent ? (
            <ActiveGameComponent
              gameId={game.id}
              gameTitle={game.title}
              bestScore={bestScore}
              isMuted={profile.soundMuted}
              onToggleMute={onToggleMute}
              onSessionComplete={onSessionComplete}
              onExit={handleExitToHome}
            />
          ) : game.gameBundleUrl && game.status === 'playable' ? (
            <CloudGameFrame
              gameId={game.id}
              gameTitle={game.title}
              creatorStudio={game.creatorStudio}
              gameBundleUrl={game.gameBundleUrl}
              xpRewardMultiplier={game.xpRewardMultiplier}
              isMuted={profile.soundMuted}
              onToggleMute={onToggleMute}
              onSessionComplete={onSessionComplete}
              onExit={handleExitToHome}
            />
          ) : (
            /* Interactive 16:9 Upcoming Game Preview Stage */
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <GameArtwork theme={game.artworkTheme} title={game.title} className="absolute inset-0" />
              <div className="absolute inset-0 bg-[#07070F]/78" />

              <div className="relative z-10 max-w-xl w-full mx-4 rounded-2xl bg-[#120B24]/94 border border-white/12 p-5 sm:p-7 text-center shadow-2xl">
                <div className="text-xs font-medium text-[#00F0FF]">
                  {game.category} · {game.orientation} · {game.releaseWindow ?? 'Upcoming'}
                </div>
                <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-black text-white">
                  {game.title}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {game.description}
                </p>

                <div className="mt-4 rounded-xl bg-[#07070F]/80 border border-white/8 px-4 py-3 text-xs text-slate-300 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                  <span>Controls: {game.controlsSummary}</span>
                  <span aria-hidden="true">·</span>
                  <span>{game.players}</span>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={isPreRegistered}
                    onClick={() => onPreRegister(game.id)}
                    className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                      isPreRegistered
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default'
                        : 'bg-[#FF1E42] hover:bg-[#ff3355] text-white cursor-pointer'
                    }`}
                  >
                    {isPreRegistered ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Pre-Registered (+25 XP Claimed)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Pre-Register &amp; Claim +25 XP</span>
                      </>
                    )}
                  </button>

                  {starterGame.id !== game.id && (
                    <button
                      type="button"
                      onClick={() => onSwitchGame(starterGame)}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#00F0FF] text-[#07070F] px-5 py-2.5 font-display text-xs sm:text-sm font-bold hover:brightness-110 transition cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Play {starterGame.title}</span>
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-center">
                  <a
                    href={buildWhatsAppChallengeUrl(game.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Invite Friend on WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Smart Mobile Portrait "Rotate Phone Horizontally" Overlay */}
        {isPortraitMobile && !bypassRotatePrompt && !applyCssRotation && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/95 p-6 text-center">
            <div className="max-w-xs w-full rounded-2xl bg-[#120B24] border border-[#00F0FF]/45 p-6 shadow-2xl">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-[#00F0FF]/12 border border-[#00F0FF]/40 flex items-center justify-center">
                <RotateCw
                  className="w-7 h-7 text-[#00F0FF] animate-spin"
                  style={{ animationDuration: '3s' }}
                />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">
                Rotate Phone Horizontally
              </h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                {game.title} is built for 16:9 Landscape Mode. Rotate your device or tap Force
                Landscape Mode below to start immediately.
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleEnableLandscape()}
                  className="min-h-[44px] w-full rounded-xl bg-[#FF1E42] text-xs font-bold text-white hover:bg-[#ff3355] transition cursor-pointer"
                >
                  Force Landscape Mode
                </button>
                <button
                  type="button"
                  onClick={() => setBypassRotatePrompt(true)}
                  className="min-h-[40px] w-full rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Continue in Portrait
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
