import React, { useState } from 'react';
import type { GameArtworkTheme } from '../types';

interface GameArtworkProps {
  theme: GameArtworkTheme;
  title: string;
  className?: string;
}

/**
 * High-contrast visual cover art for each portal title.
 * Uses attached official artwork for Chrono Slayer 3D with bespoke SVG fallback.
 */
export const GameArtwork: React.FC<GameArtworkProps> = ({ theme, title, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#0A0817] select-none ${className}`}
      aria-label={`${title} cover artwork`}
    >
      {theme === 'chrono-slayer' && !imgError && (
        <img
          src="/assets/aistudio/IMG_20261123_200155_bf5615db.jpg"
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center"
        />
      )}

      {theme === 'chrono-slayer' && imgError && (
        <svg viewBox="0 0 640 360" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="cs-bg" cx="62%" cy="42%" r="65%">
              <stop offset="0%" stopColor="#3B0D2E" />
              <stop offset="55%" stopColor="#120B24" />
              <stop offset="100%" stopColor="#07070F" />
            </radialGradient>
            <linearGradient id="cs-blade" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FF1E42" />
            </linearGradient>
          </defs>
          <rect width="640" height="360" fill="url(#cs-bg)" />
          {/* 3D Perspective Floor Grid */}
          <g stroke="#00F0FF" strokeOpacity="0.16" strokeWidth="1">
            <path d="M0 260 L640 260 M0 285 L640 285 M0 318 L640 318 M0 355 L640 355" />
            <path d="M320 210 L40 360 M320 210 L180 360 M320 210 L320 360 M320 210 L460 360 M320 210 L600 360" />
          </g>
          {/* Temporal Chrono Ring */}
          <circle cx="430" cy="165" r="108" fill="none" stroke="#FF1E42" strokeWidth="3" strokeOpacity="0.65" strokeDasharray="18 10" />
          <circle cx="430" cy="165" r="82" fill="none" stroke="#00F0FF" strokeWidth="2" strokeOpacity="0.8" strokeDasharray="40 14" />
          {/* Knight Helmet Silhouette */}
          <path d="M430 82 L474 114 L468 186 L430 226 L392 186 L386 114 Z" fill="#0B0B17" stroke="#00F0FF" strokeWidth="2.5" />
          <path d="M402 142 L423 151 L418 160 L400 151 Z" fill="#FF1E42" />
          <path d="M458 142 L437 151 L442 160 L460 151 Z" fill="#FF1E42" />
          {/* Diagonal Energy Slash */}
          <path d="M235 280 L570 46 L588 64 L268 302 Z" fill="url(#cs-blade)" fillOpacity="0.92" />
          <circle cx="430" cy="165" r="140" fill="none" stroke="#FFFFFF" strokeOpacity="0.06" />
        </svg>
      )}

      {theme === 'reflex-arena' && (
        <svg viewBox="0 0 640 360" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="ra-bg" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#16143A" />
              <stop offset="65%" stopColor="#0B0A1B" />
              <stop offset="100%" stopColor="#07070F" />
            </radialGradient>
          </defs>
          <rect width="640" height="360" fill="url(#ra-bg)" />
          <g stroke="#00F0FF" strokeOpacity="0.12" strokeWidth="1">
            <rect x="40" y="30" width="560" height="300" rx="16" fill="none" />
            <circle cx="320" cy="180" r="120" fill="none" />
            <circle cx="320" cy="180" r="65" fill="none" stroke="#FF1E42" strokeOpacity="0.25" />
          </g>
          {/* Cyan Target Orb */}
          <circle cx="215" cy="145" r="34" fill="#00F0FF" fillOpacity="0.22" stroke="#00F0FF" strokeWidth="3" />
          <circle cx="215" cy="145" r="16" fill="#FFFFFF" />
          <circle cx="215" cy="145" r="46" fill="none" stroke="#00F0FF" strokeWidth="2" strokeDasharray="34 12" />
          {/* Crimson Target Core */}
          <circle cx="425" cy="195" r="28" fill="#FF1E42" fillOpacity="0.26" stroke="#FF1E42" strokeWidth="3" />
          <circle cx="425" cy="195" r="12" fill="#FFFFFF" />
          {/* Slash Line */}
          <path d="M130 220 Q280 90 480 220" fill="none" stroke="#00F0FF" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.85" />
          {/* Gold Shard */}
          <polygon points="340,86 356,108 340,130 324,108" fill="#FACC15" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      )}

      {theme === 'apex-drift' && (
        <svg viewBox="0 0 640 360" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <rect width="640" height="360" fill="#080A17" />
          {/* Skyline silhouette */}
          <path d="M0 185 H65 V125 H110 V165 H165 V95 H215 V175 H290 V115 H355 V175 H430 V105 H490 V160 H555 V120 H640 V360 H0 Z" fill="#120B24" />
          {/* Wet highway asphalt */}
          <polygon points="0,360 225,205 415,205 640,360" fill="#0E0E1F" />
          <line x1="320" y1="205" x2="320" y2="360" stroke="#00F0FF" strokeWidth="3" strokeDasharray="16 14" />
          <line x1="225" y1="205" x2="25" y2="360" stroke="#FF1E42" strokeWidth="3" />
          <line x1="415" y1="205" x2="615" y2="360" stroke="#FF1E42" strokeWidth="3" />
          {/* Drift Hypercar Silhouette */}
          <path d="M225 295 L268 258 L378 258 L422 292 L418 318 L222 318 Z" fill="#16162E" stroke="#00F0FF" strokeWidth="2.5" />
          <rect x="242" y="294" width="38" height="8" rx="3" fill="#FF1E42" />
          <rect x="364" y="294" width="38" height="8" rx="3" fill="#FF1E42" />
          {/* Drift tire sparks */}
          <path d="M220 318 Q160 330 110 350" stroke="#FF1E42" strokeWidth="3" fill="none" strokeOpacity="0.8" />
          <path d="M420 318 Q475 330 530 350" stroke="#00F0FF" strokeWidth="3" fill="none" strokeOpacity="0.8" />
        </svg>
      )}

      {theme === 'void-survivor' && (
        <svg viewBox="0 0 640 360" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <rect width="640" height="360" fill="#0B0716" />
          <circle cx="320" cy="180" r="145" fill="none" stroke="#FF1E42" strokeOpacity="0.22" strokeWidth="2" strokeDasharray="10 8" />
          <circle cx="320" cy="180" r="92" fill="none" stroke="#00F0FF" strokeOpacity="0.35" strokeWidth="2" />
          {/* Orbiting Blades */}
          <polygon points="320,66 332,90 308,90" fill="#00F0FF" />
          <polygon points="320,294 332,270 308,270" fill="#00F0FF" />
          <polygon points="206,180 230,168 230,192" fill="#00F0FF" />
          <polygon points="434,180 410,168 410,192" fill="#00F0FF" />
          {/* Center Hero Core */}
          <polygon points="320,142 354,180 320,218 286,180" fill="#120B24" stroke="#FFFFFF" strokeWidth="2.5" />
          {/* Enemy Drones */}
          <circle cx="145" cy="95" r="14" fill="#FF1E42" fillOpacity="0.8" />
          <circle cx="515" cy="115" r="16" fill="#FF1E42" fillOpacity="0.8" />
          <circle cx="170" cy="275" r="15" fill="#FF1E42" fillOpacity="0.8" />
          <circle cx="495" cy="260" r="14" fill="#FF1E42" fillOpacity="0.8" />
        </svg>
      )}

      {theme === 'neon-duel' && (
        <svg viewBox="0 0 640 360" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <rect width="640" height="360" fill="#090814" />
          <polygon points="0,0 340,0 295,360 0,360" fill="#FF1E42" fillOpacity="0.14" />
          <polygon points="340,0 640,0 640,360 295,360" fill="#00F0FF" fillOpacity="0.14" />
          <line x1="340" y1="0" x2="295" y2="360" stroke="#FFFFFF" strokeWidth="3" strokeOpacity="0.5" />
          {/* Left Player Blade */}
          <path d="M135 255 L265 115" stroke="#FF1E42" strokeWidth="10" strokeLinecap="round" />
          {/* Right Player Blade */}
          <path d="M505 255 L375 115" stroke="#00F0FF" strokeWidth="10" strokeLinecap="round" />
          {/* Clash Spark */}
          <circle cx="320" cy="145" r="26" fill="#FFFFFF" fillOpacity="0.9" />
          <circle cx="320" cy="145" r="46" fill="none" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="2" />
        </svg>
      )}

      {theme === 'cyber-pulse' && (
        <svg viewBox="0 0 640 360" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <rect width="640" height="360" fill="#07070F" />
          {[32, 68, 112, 165, 230].map((r, i) => (
            <polygon
              key={r}
              points={`320,${180 - r * 0.72} ${320 + r},${180} 320,${180 + r * 0.72} ${320 - r},${180}`}
              fill="none"
              stroke={i % 2 === 0 ? '#00F0FF' : '#FF1E42'}
              strokeWidth="2.5"
              strokeOpacity={0.25 + i * 0.14}
            />
          ))}
          <polygon points="320,248 352,298 288,298" fill="#00F0FF" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
};
