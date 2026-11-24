import React, { useState } from 'react';

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Renders /logo.png from public/ with a glowing crimson-and-cyan Knight Shield
 * SVG badge fallback if the image asset is unavailable.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'w-10 h-10',
  alt = 'Shadow Knight Game Zone Logo',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <svg
        viewBox="0 0 128 128"
        fill="none"
        className={className}
        role="img"
        aria-label={alt}
      >
        <defs>
          <linearGradient id="sk-shield-border" x1="16" y1="12" x2="112" y2="116" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#FF1E42" />
          </linearGradient>
          <radialGradient id="sk-shield-bg" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#1E103A" />
            <stop offset="100%" stopColor="#07070F" />
          </radialGradient>
        </defs>
        <rect width="128" height="128" rx="24" fill="#07070F" />
        <path
          d="M64 12L106 28V61C106 87.5 88 109.5 64 116C40 109.5 22 87.5 22 61V28L64 12Z"
          fill="url(#sk-shield-bg)"
          stroke="url(#sk-shield-border)"
          strokeWidth="4.5"
        />
        <path
          d="M64 24L93 35.5V60C93 79.5 80.5 96 64 102C47.5 96 35 79.5 35 60V35.5L64 24Z"
          fill="#120B24"
          stroke="#FF1E42"
          strokeWidth="2.5"
          strokeOpacity="0.85"
        />
        {/* Crossed energy blades */}
        <path d="M36 92L92 38" stroke="#00F0FF" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.85" />
        <path d="M92 92L36 38" stroke="#FF1E42" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.85" />
        {/* Knight Helm Crest & Glowing Crimson Eyes */}
        <path
          d="M64 31L80 46L76 80L64 93L52 80L48 46L64 31Z"
          fill="#0B0B19"
          stroke="#E2E8F0"
          strokeWidth="2"
        />
        <path d="M51 54L61 59L58 64L49 59L51 54Z" fill="#FF1E42" />
        <path d="M77 54L67 59L70 64L79 59L77 54Z" fill="#FF1E42" />
        <path d="M64 36L68 47L64 78L60 47L64 36Z" fill="#00F0FF" />
      </svg>
    );
  }

  return (
    <img
      src="/logo.png"
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`object-cover rounded-xl ${className}`}
    />
  );
};
