import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 sm:right-auto z-40 inline-flex items-center gap-2.5 rounded-xl bg-[#120B24]/95 border border-amber-400/40 px-4 py-2.5 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-md"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Offline Mode · Cached games &amp; local high scores remain playable.</span>
    </div>
  );
};
