import React, { useState } from 'react';

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Renders /logo.png from public/ with a crisp inline SVG knight-shield fallback
 * if the image asset is unavailable.
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
        <rect width="128" height="128" rx="24" fill="#120B24" />
        <path
          d="M64 14L104 29V61C104 86.4 86.9 107.6 64 114C41.1 107.6 24 86.4 24 61V29L64 14Z"
          fill="#07070F"
          stroke="#00F0FF"
          strokeWidth="4"
        />
        <path
          d="M64 25L92 36V60C92 78.8 80 94.8 64 101C48 94.8 36 78.8 36 60V36L64 25Z"
          fill="#120B24"
          stroke="#FF1E42"
          strokeWidth="2.5"
        />
        <path d="M46 49L58 55L55 62L44 56L46 49Z" fill="#FF1E42" />
        <path d="M82 49L70 55L73 62L84 56L82 49Z" fill="#FF1E42" />
        <path d="M64 34L70 46L64 88L58 46L64 34Z" fill="#00F0FF" />
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
