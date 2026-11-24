import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-[#00F0FF]/45 bg-[#00F0FF]/10 px-3.5 py-2 text-xs font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/20 transition whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:border-[#00F0FF]/50 transition whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#120B24] border border-white/15 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-bold text-white">
                  Install Shadow Knight Game Zone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2.5 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="font-mono-nums font-bold text-[#00F0FF]">1.</span>
                  <span>
                    Tap the <Share className="inline w-4 h-4 text-[#00F0FF] mx-0.5" />{' '}
                    <strong>Share</strong> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-nums font-bold text-[#00F0FF]">2.</span>
                  <span>
                    Scroll down and select <strong>Add to Home Screen</strong> for full-screen
                    offline play.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[#FF1E42] text-sm font-semibold text-white hover:bg-[#ff3355] transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
