import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileCheck2,
  MessageCircle,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { buildSupportWhatsAppUrl, SUPPORT_CONTACT } from '../config/contact';

interface SupportContactModalProps {
  isOpen: boolean;
  whatsappSupportNumber: string;
  onClose: () => void;
}

export const SupportContactModal: React.FC<SupportContactModalProps> = ({
  isOpen,
  whatsappSupportNumber,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [studioName, setStudioName] = useState('');
  const [gameTitle, setGameTitle] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [legalConfirmed, setLegalConfirmed] = useState(false);
  const [formError, setFormError] = useState('');
  const hiddenSubmitLinkRef = useRef<HTMLAnchorElement | null>(null);

  const liveNumberDisplay = whatsappSupportNumber || SUPPORT_CONTACT.whatsappDisplay;

  const proposalWhatsAppUrl = useMemo(() => {
    const body = [
      'Shadow Knight Game Zone — Game Submission & Legal Declaration',
      `Creator / Studio: ${studioName.trim() || 'N/A'}`,
      `Game Title: ${gameTitle.trim() || 'N/A'}`,
      `Demo URL: ${demoUrl.trim() || 'N/A'}`,
      'Legal Ownership Confirmed: Yes, I confirm 100% original ownership and publishing rights.',
    ].join('\n');
    return buildSupportWhatsAppUrl(body, liveNumberDisplay);
  }, [demoUrl, gameTitle, liveNumberDisplay, studioName]);

  if (!isOpen) return null;

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(liveNumberDisplay);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleProposalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioName.trim() || !gameTitle.trim() || !demoUrl.trim()) {
      setFormError('Please fill in your Studio Name, Game Title, and Demo URL.');
      return;
    }
    if (!legalConfirmed) {
      setFormError(
        'You must confirm 100% legal ownership and rights before submitting a game.'
      );
      return;
    }
    setFormError('');
    hiddenSubmitLinkRef.current?.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Support and Contact With Us"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#120B24]/92 backdrop-blur-xl border border-[#00F0FF]/30 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-[#120B24]/95 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#00F0FF]" />
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              Support &amp; Contact With Us
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close support modal"
            className="min-w-[46px] min-h-[46px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Legal Review & Creator Publishing Policy */}
          <div className="rounded-xl bg-[#07070F]/80 border border-white/10 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <FileCheck2 className="w-5 h-5 text-[#FF1E42] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-sm font-bold text-white">
                  Original Game Testing &amp; Legal Verification Policy
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  External developers and indie studios may submit original HTML5 / WebGL games for
                  testing or publishing on <strong className="text-white">Shadow Knight Game Zone</strong>{' '}
                  <strong className="text-[#00F0FF]">
                    ONLY after legal rights verification and a signed creator agreement
                  </strong>
                  . Cloned, stolen, or unlicensed assets are strictly rejected.
                </p>
              </div>
            </div>

            {/* Direct WhatsApp Support & Copy Number */}
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-400">Official Creator Desk WhatsApp</div>
                <div className="font-mono-nums text-sm font-bold text-white mt-0.5">
                  {liveNumberDisplay}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyNumber()}
                  className="min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 px-5 py-3 text-sm font-bold text-slate-100 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#00F0FF]" />
                      <span>Copy Number</span>
                    </>
                  )}
                </button>

                <a
                  href={buildSupportWhatsAppUrl(undefined, liveNumberDisplay)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-5 py-3 text-sm font-extrabold text-white transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Submit Game Proposal & Legal Rights Declaration Form */}
          <form
            onSubmit={handleProposalSubmit}
            className="rounded-xl bg-[#07070F]/80 border border-white/10 p-4 sm:p-5 space-y-4"
          >
            <div>
              <h3 className="font-display text-sm font-bold text-white">
                Submit Game Proposal &amp; Legal Rights Declaration
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Complete all fields below to generate a verified WhatsApp submission package.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="sk-studio-name"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Creator / Studio Name
                </label>
                <input
                  id="sk-studio-name"
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder="e.g. Obsidian Forge Studio"
                  className="w-full min-h-[42px] rounded-lg bg-[#120B24] border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="sk-game-title"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Game Title
                </label>
                <input
                  id="sk-game-title"
                  type="text"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  placeholder="e.g. Astral Vanguard 3D"
                  className="w-full min-h-[42px] rounded-lg bg-[#120B24] border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sk-demo-url"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Playable Demo URL
              </label>
              <input
                id="sk-demo-url"
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://your-demo.vercel.app"
                className="w-full min-h-[42px] rounded-lg bg-[#120B24] border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={legalConfirmed}
                onChange={(e) => setLegalConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/25 bg-[#120B24] accent-[#FF1E42]"
              />
              <span>
                I legally declare <strong className="text-white">100% ownership</strong> of this
                game&apos;s source code, artwork, and audio, and agree to complete legal rights
                verification before publishing on Shadow Knight Game Zone.
              </span>
            </label>

            {formError && (
              <div role="alert" className="text-xs font-medium text-[#FF1E42]">
                {formError}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-500">
                © 2026 Shadow Knight Game Zone. All Rights Reserved.
              </span>
              <button
                type="submit"
                className="min-h-[50px] inline-flex items-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-7 py-3.5 text-sm sm:text-base font-extrabold text-white transition cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Submit via WhatsApp</span>
              </button>
              <a
                ref={hiddenSubmitLinkRef}
                href={proposalWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden"
                aria-hidden="true"
              >
                WhatsApp Submission Link
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
