import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Home,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Shield,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { GameComponentProps } from '../types';
import { buildWhatsAppChallengeUrl } from '../utils/playerStorage';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type Difficulty = 'knight' | 'shadow' | 'overdrive';
type TargetKind = 'cyan-orb' | 'crimson-core' | 'gold-shard' | 'void-mine';

interface ArenaTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: TargetKind;
  age: number;
  lifespan: number;
  rotation: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface SlashTrailPoint {
  x: number;
  y: number;
  life: number;
}

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 540;
const ROUND_DURATION = 45;

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    label: string;
    multiplier: number;
    spawnIntervalMs: number;
    speedScale: number;
    lifespanScale: number;
    mineChance: number;
    summary: string;
  }
> = {
  knight: {
    label: 'Knight',
    multiplier: 1.0,
    spawnIntervalMs: 760,
    speedScale: 1.0,
    lifespanScale: 1.15,
    mineChance: 0.14,
    summary: 'Balanced speed · 1.0x Score',
  },
  shadow: {
    label: 'Shadow',
    multiplier: 1.4,
    spawnIntervalMs: 580,
    speedScale: 1.32,
    lifespanScale: 0.95,
    mineChance: 0.2,
    summary: 'Fast targets · 1.4x Score',
  },
  overdrive: {
    label: 'Overdrive',
    multiplier: 1.85,
    spawnIntervalMs: 440,
    speedScale: 1.65,
    lifespanScale: 0.8,
    mineChance: 0.25,
    summary: 'Hyper reflex · 1.85x Score',
  },
};

export const ShadowReflexArena: React.FC<GameComponentProps> = ({
  gameId,
  gameTitle,
  bestScore,
  isMuted,
  onToggleMute,
  onSessionComplete,
  onExit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('knight');
  const [hudScore, setHudScore] = useState(0);
  const [hudCombo, setHudCombo] = useState(1);
  const [hudShields, setHudShields] = useState(3);
  const [hudTimeLeft, setHudTimeLeft] = useState(ROUND_DURATION);
  const [summaryStats, setSummaryStats] = useState<{
    score: number;
    maxCombo: number;
    accuracy: number;
    xpEarned: number;
    coinsEarned: number;
    isNewBest: boolean;
  } | null>(null);

  // Mutable simulation state kept in ref for 60fps loop without React re-render overhead
  const simRef = useRef({
    targets: [] as ArenaTarget[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    trail: [] as SlashTrailPoint[],
    nextId: 1,
    score: 0,
    combo: 1,
    maxCombo: 1,
    shields: 3,
    bonusCoins: 0,
    hits: 0,
    clicks: 0,
    timeLeft: ROUND_DURATION,
    spawnTimerMs: 0,
    shakePower: 0,
    gridOffset: 0,
    reportedSession: false,
  });

  const getAudioContext = useCallback((): AudioContext | null => {
    if (isMuted) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, [isMuted]);

  const playSynthTone = useCallback(
    (freq: number, duration: number, type: OscillatorType, gainPeak = 0.14, slideTo?: number) => {
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
        }
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      } catch {
        // Ignore audio errors
      }
    },
    [getAudioContext]
  );

  const playHitFx = useCallback(
    (combo: number, kind: TargetKind) => {
      const baseFreq = kind === 'crimson-core' ? 520 : kind === 'gold-shard' ? 660 : 420;
      const pitchBoost = Math.min(480, combo * 26);
      playSynthTone(baseFreq + pitchBoost, 0.13, 'triangle', 0.15, baseFreq + pitchBoost + 180);
    },
    [playSynthTone]
  );

  const playHazardFx = useCallback(() => {
    playSynthTone(170, 0.28, 'sawtooth', 0.18, 62);
  }, [playSynthTone]);

  const playGameOverFx = useCallback(() => {
    playSynthTone(360, 0.2, 'sine', 0.12, 180);
    setTimeout(() => playSynthTone(240, 0.35, 'triangle', 0.14, 110), 140);
  }, [playSynthTone]);

  const spawnTarget = useCallback((diff: Difficulty) => {
    const cfg = DIFFICULTY_CONFIG[diff];
    const roll = Math.random();
    let kind: TargetKind = 'cyan-orb';
    if (roll < cfg.mineChance) {
      kind = 'void-mine';
    } else if (roll < cfg.mineChance + 0.2) {
      kind = 'crimson-core';
    } else if (roll < cfg.mineChance + 0.3) {
      kind = 'gold-shard';
    }

    const radius =
      kind === 'crimson-core' ? 24 : kind === 'gold-shard' ? 22 : kind === 'void-mine' ? 26 : 31;
    const margin = 78;
    const x = margin + Math.random() * (LOGICAL_WIDTH - margin * 2);
    const y = margin + 26 + Math.random() * (LOGICAL_HEIGHT - margin * 2 - 26);

    const speedBase = (kind === 'crimson-core' ? 120 : 68) * cfg.speedScale;
    const angle = Math.random() * Math.PI * 2;
    const lifespan =
      (kind === 'crimson-core' ? 1.55 : kind === 'gold-shard' ? 1.75 : 2.35) * cfg.lifespanScale;

    simRef.current.targets.push({
      id: simRef.current.nextId++,
      x,
      y,
      vx: Math.cos(angle) * speedBase,
      vy: Math.sin(angle) * speedBase,
      radius,
      kind,
      age: 0,
      lifespan,
      rotation: Math.random() * Math.PI * 2,
    });
  }, []);

  const finishRound = useCallback(() => {
    const s = simRef.current;
    if (s.reportedSession) return;
    s.reportedSession = true;

    const accuracy = s.clicks > 0 ? Math.min(100, Math.round((s.hits / s.clicks) * 100)) : 0;
    const xpEarned = Math.max(25, Math.round(s.score / 18) + s.maxCombo * 6);
    const coinsEarned = Math.max(10, Math.round(s.score / 55) + s.bonusCoins);
    const isNewBest = s.score > bestScore;

    playGameOverFx();
    setSummaryStats({
      score: s.score,
      maxCombo: s.maxCombo,
      accuracy,
      xpEarned,
      coinsEarned,
      isNewBest,
    });
    setGameState('GAME_OVER');

    onSessionComplete({
      gameId,
      gameTitle,
      score: s.score,
      maxCombo: s.maxCombo,
      accuracy,
      xpEarned,
      coinsEarned,
    });
  }, [bestScore, gameId, gameTitle, onSessionComplete, playGameOverFx]);

  const startRound = useCallback(
    (selectedDifficulty: Difficulty = difficulty) => {
      simRef.current = {
        targets: [],
        particles: [],
        floatingTexts: [],
        trail: [],
        nextId: 1,
        score: 0,
        combo: 1,
        maxCombo: 1,
        shields: 3,
        bonusCoins: 0,
        hits: 0,
        clicks: 0,
        timeLeft: ROUND_DURATION,
        spawnTimerMs: 0,
        shakePower: 0,
        gridOffset: 0,
        reportedSession: false,
      };
      setHudScore(0);
      setHudCombo(1);
      setHudShields(3);
      setHudTimeLeft(ROUND_DURATION);
      setSummaryStats(null);
      spawnTarget(selectedDifficulty);
      spawnTarget(selectedDifficulty);
      playSynthTone(520, 0.14, 'triangle', 0.14, 780);
      setGameState('PLAYING');
    },
    [difficulty, playSynthTone, spawnTarget]
  );

  // Keyboard shortcuts while inside arena
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
        if (gameState === 'PLAYING') {
          e.preventDefault();
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED') {
          e.preventDefault();
          setGameState('PLAYING');
        }
      } else if (e.key === 'm' || e.key === 'M') {
        onToggleMute();
      } else if (e.key === 'r' || e.key === 'R') {
        if (gameState === 'GAME_OVER' || gameState === 'PAUSED') {
          startRound(difficulty);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [difficulty, gameState, onToggleMute, startRound]);

  // Main 60fps simulation & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = LOGICAL_WIDTH * dpr;
    canvas.height = LOGICAL_HEIGHT * dpr;

    let rafId = 0;
    let lastTimestamp = performance.now();
    let hudSyncAccum = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      const s = simRef.current;
      const cfg = DIFFICULTY_CONFIG[difficulty];

      if (gameState === 'PLAYING') {
        s.timeLeft = Math.max(0, s.timeLeft - dt);
        s.gridOffset = (s.gridOffset + dt * 45) % 48;
        s.shakePower = Math.max(0, s.shakePower - dt * 28);

        s.spawnTimerMs += dt * 1000;
        if (s.spawnTimerMs >= cfg.spawnIntervalMs && s.targets.length < 9) {
          s.spawnTimerMs = 0;
          spawnTarget(difficulty);
        }

        // Update targets
        const nextTargets: ArenaTarget[] = [];
        for (const t of s.targets) {
          t.age += dt;
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.rotation += dt * (t.kind === 'void-mine' ? 2.4 : 1.3);

          if (t.x < t.radius + 24 || t.x > LOGICAL_WIDTH - t.radius - 24) {
            t.vx *= -1;
            t.x = Math.max(t.radius + 24, Math.min(LOGICAL_WIDTH - t.radius - 24, t.x));
          }
          if (t.y < t.radius + 64 || t.y > LOGICAL_HEIGHT - t.radius - 20) {
            t.vy *= -1;
            t.y = Math.max(t.radius + 64, Math.min(LOGICAL_HEIGHT - t.radius - 20, t.y));
          }

          if (t.age < t.lifespan) {
            nextTargets.push(t);
          } else if (t.kind !== 'void-mine') {
            // Missed a valid orb -> reset combo gently
            if (s.combo > 1) {
              s.combo = 1;
            }
          }
        }
        s.targets = nextTargets;

        // Update particles
        s.particles = s.particles.filter((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.life -= dt;
          return p.life > 0;
        });

        // Update floating score texts
        s.floatingTexts = s.floatingTexts.filter((ft) => {
          ft.y -= dt * 42;
          ft.life -= dt;
          return ft.life > 0;
        });

        // Update slash trail
        s.trail = s.trail.filter((pt) => {
          pt.life -= dt * 3.8;
          return pt.life > 0;
        });

        hudSyncAccum += dt;
        if (hudSyncAccum >= 0.08) {
          hudSyncAccum = 0;
          setHudScore(s.score);
          setHudCombo(s.combo);
          setHudShields(s.shields);
          setHudTimeLeft(Math.ceil(s.timeLeft));
        }

        if (s.timeLeft <= 0 || s.shields <= 0) {
          setHudScore(s.score);
          setHudCombo(s.combo);
          setHudShields(s.shields);
          setHudTimeLeft(Math.ceil(s.timeLeft));
          finishRound();
        }
      } else {
        // Gentle idle grid animation in menus
        s.gridOffset = (s.gridOffset + dt * 18) % 48;
      }

      // Render frame
      ctx.save();
      ctx.scale(dpr, dpr);

      if (s.shakePower > 0.2) {
        const dx = (Math.random() - 0.5) * s.shakePower;
        const dy = (Math.random() - 0.5) * s.shakePower;
        ctx.translate(dx, dy);
      }

      // Deep void backdrop
      const bgGrad = ctx.createRadialGradient(
        LOGICAL_WIDTH * 0.5,
        LOGICAL_HEIGHT * 0.45,
        40,
        LOGICAL_WIDTH * 0.5,
        LOGICAL_HEIGHT * 0.5,
        LOGICAL_WIDTH * 0.68
      );
      bgGrad.addColorStop(0, '#140C2B');
      bgGrad.addColorStop(0.6, '#0A0918');
      bgGrad.addColorStop(1, '#06060C');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Perspective cyber floor grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.075)';
      ctx.lineWidth = 1;
      for (let gx = (s.gridOffset % 48) - 48; gx < LOGICAL_WIDTH; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 56);
        ctx.lineTo(gx, LOGICAL_HEIGHT);
        ctx.stroke();
      }
      for (let gy = 56 + (s.gridOffset % 48); gy < LOGICAL_HEIGHT; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(LOGICAL_WIDTH, gy);
        ctx.stroke();
      }

      // Center crest watermark ring (subtle geometric arena ring)
      ctx.strokeStyle = 'rgba(255, 30, 66, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 16, 130, 0, Math.PI * 2);
      ctx.stroke();

      // Render pointer slash trail
      if (s.trail.length > 1) {
        for (let i = 1; i < s.trail.length; i++) {
          const prev = s.trail[i - 1];
          const curr = s.trail[i];
          ctx.strokeStyle = `rgba(0, 240, 255, ${Math.max(0, curr.life * 0.65)})`;
          ctx.lineWidth = Math.max(1, curr.life * 5);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }
      }

      // Render targets
      for (const t of s.targets) {
        const remainingRatio = Math.max(0, 1 - t.age / t.lifespan);
        const entryScale = Math.min(1, t.age / 0.12);
        const r = t.radius * entryScale;

        ctx.save();
        ctx.translate(t.x, t.y);

        if (t.kind === 'void-mine') {
          // Hazard mine: spiked crimson-violet warning core
          ctx.rotate(t.rotation);
          ctx.strokeStyle = '#FF1E42';
          ctx.fillStyle = 'rgba(255, 30, 66, 0.2)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          const spikes = 8;
          for (let i = 0; i < spikes * 2; i++) {
            const rad = i % 2 === 0 ? r * 1.12 : r * 0.68;
            const ang = (i * Math.PI) / spikes;
            if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
            else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Cross X hazard icon
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-7, -7);
          ctx.lineTo(7, 7);
          ctx.moveTo(7, -7);
          ctx.lineTo(-7, 7);
          ctx.stroke();
        } else {
          const primary =
            t.kind === 'crimson-core'
              ? '#FF1E42'
              : t.kind === 'gold-shard'
              ? '#FACC15'
              : '#00F0FF';

          // Timing countdown outer ring
          ctx.strokeStyle = primary;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, r + 9 * remainingRatio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingRatio);
          ctx.stroke();

          // Inner glowing orb
          const orbGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 2, 0, 0, r);
          orbGrad.addColorStop(0, '#FFFFFF');
          orbGrad.addColorStop(0.35, primary);
          orbGrad.addColorStop(1, 'rgba(7, 7, 15, 0.9)');
          ctx.fillStyle = orbGrad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          // Knight diamond sigil inside orb
          ctx.rotate(t.rotation);
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.45);
          ctx.lineTo(r * 0.45, 0);
          ctx.lineTo(0, r * 0.45);
          ctx.lineTo(-r * 0.45, 0);
          ctx.closePath();
          ctx.stroke();
        }

        ctx.restore();
      }

      // Render particles
      for (const p of s.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Render floating score feedback
      for (const ft of s.floatingTexts) {
        ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
        ctx.font = '700 16px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [difficulty, finishRound, gameState, spawnTarget]);

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const isCssRotated =
      rect.width < rect.height && canvas.clientWidth > canvas.clientHeight;
    if (isCssRotated) {
      const x = ((clientY - rect.top) / rect.height) * LOGICAL_WIDTH;
      const y = (1 - (clientX - rect.left) / rect.width) * LOGICAL_HEIGHT;
      return { x, y };
    }
    const x = ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;
    return { x, y };
  };

  const emitBurst = (x: number, y: number, color: string, count = 16) => {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const spd = 85 + Math.random() * 190;
      simRef.current.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.42 + Math.random() * 0.22,
        maxLife: 0.64,
        color,
        size: 3 + Math.random() * 3.5,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const coords = toCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;
    simRef.current.trail.push({ x: coords.x, y: coords.y, life: 1 });
    if (simRef.current.trail.length > 16) {
      simRef.current.trail.shift();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const coords = toCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    const s = simRef.current;
    const cfg = DIFFICULTY_CONFIG[difficulty];
    s.clicks += 1;

    // Check from topmost target backwards
    for (let i = s.targets.length - 1; i >= 0; i--) {
      const t = s.targets[i];
      const dx = coords.x - t.x;
      const dy = coords.y - t.y;
      const hitRadius = t.radius + 14; // generous touch hitbox
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        s.targets.splice(i, 1);

        if (t.kind === 'void-mine') {
          s.shields = Math.max(0, s.shields - 1);
          s.combo = 1;
          s.shakePower = 14;
          emitBurst(t.x, t.y, '#FF1E42', 22);
          s.floatingTexts.push({
            x: t.x,
            y: t.y - 10,
            text: 'SHIELD HIT!',
            color: '#FF1E42',
            life: 0.85,
            maxLife: 0.85,
          });
          playHazardFx();
          setHudShields(s.shields);
          setHudCombo(1);
          if (s.shields <= 0) {
            finishRound();
          }
          return;
        }

        // Valid strike!
        s.hits += 1;
        const basePoints =
          t.kind === 'crimson-core' ? 220 : t.kind === 'gold-shard' ? 160 : 100;
        const timingRatio = t.age / t.lifespan;
        const isPerfect = timingRatio >= 0.62;
        const earned = Math.round(
          basePoints * (1 + (s.combo - 1) * 0.25) * cfg.multiplier * (isPerfect ? 1.25 : 1)
        );

        s.score += earned;
        s.combo = Math.min(25, s.combo + 1);
        s.maxCombo = Math.max(s.maxCombo, s.combo);

        if (t.kind === 'crimson-core') {
          s.timeLeft = Math.min(ROUND_DURATION, s.timeLeft + 1);
        } else if (t.kind === 'gold-shard') {
          s.bonusCoins += 5;
        }

        const fxColor =
          t.kind === 'crimson-core'
            ? '#FF1E42'
            : t.kind === 'gold-shard'
            ? '#FACC15'
            : '#00F0FF';
        emitBurst(t.x, t.y, fxColor, 18);
        s.floatingTexts.push({
          x: t.x,
          y: t.y - 12,
          text: isPerfect ? `+${earned} PERFECT` : `+${earned}`,
          color: fxColor,
          life: 0.75,
          maxLife: 0.75,
        });

        playHitFx(s.combo, t.kind);
        setHudScore(s.score);
        setHudCombo(s.combo);

        // Keep arena lively
        if (s.targets.length < 2) {
          spawnTarget(difficulty);
        }
        return;
      }
    }

    // Missed click resets combo
    if (s.combo > 1) {
      s.combo = 1;
      setHudCombo(1);
    }
    s.floatingTexts.push({
      x: coords.x,
      y: coords.y - 6,
      text: 'MISS',
      color: '#64748B',
      life: 0.45,
      maxLife: 0.45,
    });
  };

  return (
    <div
      className="relative w-full h-full bg-[#07070F] select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 60fps 16:9 Canvas */}
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block touch-none cursor-crosshair"
      />

      {/* Semantic Top HUD Overlay */}
      <div className="pointer-events-none absolute top-0 inset-x-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-b from-[#07070F]/90 via-[#07070F]/60 to-transparent">
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Score</div>
            <div className="font-mono-nums text-lg sm:text-xl font-bold text-white leading-tight">
              {hudScore.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Combo</div>
            <div className="font-mono-nums text-lg sm:text-xl font-bold text-[#00F0FF] leading-tight">
              {hudCombo}x
            </div>
          </div>

          <div className="flex items-center gap-1.5" aria-label={`Shields: ${hudShields} of 3`}>
            {[0, 1, 2].map((idx) => (
              <Shield
                key={idx}
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                  idx < hudShields ? 'text-[#FF1E42] fill-[#FF1E42]/30' : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="text-right mr-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Time</div>
            <div
              className={`font-mono-nums text-lg sm:text-xl font-bold leading-tight ${
                hudTimeLeft <= 10 ? 'text-[#FF1E42]' : 'text-white'
              }`}
            >
              {hudTimeLeft}s
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-[#120B24]/85 border border-white/10 text-slate-200 hover:border-[#00F0FF]/50 hover:text-white transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {gameState === 'PLAYING' && (
            <button
              type="button"
              onClick={() => setGameState('PAUSED')}
              aria-label="Pause Game"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-[#120B24]/85 border border-white/10 text-slate-200 hover:border-[#FF1E42]/60 hover:text-white transition"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title Menu Overlay */}
      {gameState === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07070F]/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#120B24]/95 border border-white/10 p-5 sm:p-7 text-center shadow-2xl">
            <div className="text-xs font-medium tracking-wider text-[#00F0FF] uppercase">
              Shadow Knight Game Zone · Reflex Arena
            </div>
            <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              SHADOW REFLEX ARENA
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Strike Cyan Orbs, Crimson Cores (+1s), and Gold Shards before their rings collapse.
              Avoid spiked Void Mines to protect your 3 shields.
            </p>

            {/* Difficulty selector */}
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((key) => {
                const cfg = DIFFICULTY_CONFIG[key];
                const active = difficulty === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDifficulty(key)}
                    className={`rounded-xl px-3 py-2.5 text-left border transition cursor-pointer ${
                      active
                        ? 'bg-[#FF1E42]/20 border-[#FF1E42] text-white'
                        : 'bg-[#07070F]/70 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="font-display text-xs sm:text-sm font-bold">{cfg.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400 leading-snug">
                      {cfg.summary}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => startRound(difficulty)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-7 py-2.5 font-display text-sm font-bold text-white shadow-lg shadow-[#FF1E42]/25 transition active:scale-[0.98] cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Match
              </button>

              {bestScore > 0 && (
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-mono-nums px-3 py-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Personal Best: {bestScore.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07070F]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#120B24] border border-white/10 p-6 text-center shadow-2xl">
            <h3 className="font-display text-xl font-bold text-white">Match Paused</h3>
            <p className="mt-1.5 text-xs text-slate-400">
              Press Space or Resume to jump back into the arena.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00F0FF] text-[#07070F] font-display text-sm font-bold hover:brightness-110 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume Match
              </button>
              <button
                type="button"
                onClick={() => startRound(difficulty)}
                className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-sm font-medium hover:bg-white/10 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </button>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] w-full rounded-xl text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
              >
                Exit to Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Summary & WhatsApp Viral Challenge */}
      {gameState === 'GAME_OVER' && summaryStats && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07070F]/88 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#120B24] border border-white/12 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-[#00F0FF]">
                  {summaryStats.isNewBest ? 'New Personal Best!' : 'Match Complete'}
                </div>
                <h3 className="font-display text-2xl font-extrabold text-white">GAME OVER</h3>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Final Score</div>
                <div className="font-mono-nums text-2xl font-bold text-[#FF1E42]">
                  {summaryStats.score.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-[#07070F]/80 border border-white/8 p-3 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Max Combo</div>
                <div className="font-mono-nums text-sm sm:text-base font-bold text-[#00F0FF]">
                  {summaryStats.maxCombo}x
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Accuracy</div>
                <div className="font-mono-nums text-sm sm:text-base font-bold text-white">
                  {summaryStats.accuracy}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">XP Gained</div>
                <div className="font-mono-nums text-sm sm:text-base font-bold text-emerald-400">
                  +{summaryStats.xpEarned}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Coins</div>
                <div className="font-mono-nums text-sm sm:text-base font-bold text-amber-400">
                  +{summaryStats.coinsEarned}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => startRound(difficulty)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-4 py-2.5 font-display text-xs sm:text-sm font-bold text-white transition cursor-pointer"
              >
                <Zap className="w-4 h-4 shrink-0" />
                Play Again
              </button>

              <a
                href={buildWhatsAppChallengeUrl(gameTitle, summaryStats.score)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                Challenge Friend on WhatsApp
              </a>

              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#07070F] hover:bg-white/10 border border-white/20 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
              >
                <Home className="w-4 h-4 shrink-0 text-[#00F0FF]" />
                Back to Home
              </button>
            </div>

            <div className="mt-3 text-center text-[11px] text-slate-400">
              © 2026 Shadow Knight Game Zone. All Rights Reserved.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
