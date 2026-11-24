import React from 'react';
import { BrandLogo } from './BrandLogo';

interface BrandedLoaderProps {
  visible: boolean;
}

export const BrandedLoader: React.FC<BrandedLoaderProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07070F] px-6 text-center transition-opacity duration-300"
      role="status"
      aria-label="Loading Shadow Knight Game Zone"
    >
      <div className="relative flex flex-col items-center">
        <div className="p-2 rounded-2xl bg-[#120B24] border border-[#00F0FF]/30 shadow-2xl shadow-[#FF1E42]/20">
          <BrandLogo className="w-20 h-20 sm:w-24 sm:h-24" />
        </div>
        <h1 className="mt-5 font-display text-xl sm:text-2xl font-extrabold tracking-wider text-white">
          SHADOW KNIGHT GAME ZONE
        </h1>
        <p className="mt-1.5 text-xs text-slate-400">
          Preparing 16:9 Arena &amp; Offline Cache
        </p>
        <div className="mt-5 w-48 h-1 rounded-full bg-[#120B24] overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#FF1E42] to-[#00F0FF] animate-pulse" />
        </div>
      </div>

      <p className="absolute bottom-6 text-[11px] text-slate-500">
        © 2026 Shadow Knight Game Zone. All Rights Reserved.
      </p>
    </div>
  );
};
