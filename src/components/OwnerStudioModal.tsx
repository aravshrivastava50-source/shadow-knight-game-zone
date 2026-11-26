import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, Save, ShieldCheck, Wrench, X } from 'lucide-react';
import { publishOwnerCloudGame, saveOwnerPortalSettings } from '../services/cloudPlayer';
import type { GameMetadata, PortalRemoteSettings } from '../types';

interface OwnerStudioModalProps {
  isOpen: boolean;
  ownerUid: string;
  currentSettings: PortalRemoteSettings;
  onClose: () => void;
}

const CATEGORIES: GameMetadata['category'][] = [
  '3D Action',
  'Racing & Drift',
  'Arcade & Reflex',
  '2-Player',
];

export const OwnerStudioModal: React.FC<OwnerStudioModalProps> = ({
  isOpen,
  ownerUid,
  currentSettings,
  onClose,
}) => {
  const [welcomeAnnouncement, setWelcomeAnnouncement] = useState(
    currentSettings.welcomeAnnouncement
  );
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(currentSettings.welcomeSubtitle);
  const [whatsappNumber, setWhatsappNumber] = useState(currentSettings.whatsappSupportNumber);
  const [maintenanceMode, setMaintenanceMode] = useState(currentSettings.maintenanceMode);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    currentSettings.maintenanceMessage
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const [gameId, setGameId] = useState('');
  const [gameTitle, setGameTitle] = useState('');
  const [creatorStudio, setCreatorStudio] = useState('Shadow Knight Studio');
  const [category, setCategory] = useState<GameMetadata['category']>('3D Action');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('/logo.png');
  const [gameBundleUrl, setGameBundleUrl] = useState('');
  const [accentColor, setAccentColor] = useState<'cyan' | 'crimson'>('cyan');
  const [isLandscapeOnly, setIsLandscapeOnly] = useState(true);
  const [publishingGame, setPublishingGame] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setWelcomeAnnouncement(currentSettings.welcomeAnnouncement);
    setWelcomeSubtitle(currentSettings.welcomeSubtitle);
    setWhatsappNumber(currentSettings.whatsappSupportNumber);
    setMaintenanceMode(currentSettings.maintenanceMode);
    setMaintenanceMessage(currentSettings.maintenanceMessage);
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleSavePortalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      await saveOwnerPortalSettings(ownerUid, {
        welcomeAnnouncement,
        welcomeSubtitle,
        whatsappSupportNumber: whatsappNumber,
        maintenanceMode,
        maintenanceMessage,
      });
      setSettingsMsg('Portal config synced live to Cloud Firestore.');
    } catch (err) {
      setSettingsMsg(
        err instanceof Error ? err.message : 'Failed to save portal config.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePublishGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishingGame(true);
    setPublishMsg(null);
    try {
      await publishOwnerCloudGame(ownerUid, {
        id: gameId || gameTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: gameTitle,
        creatorStudio,
        category,
        subtitle,
        description,
        thumbnailUrl,
        gameBundleUrl,
        isLandscapeOnly,
        accentColor,
        xpRewardMultiplier: 1.5,
      });
      setPublishMsg('Game published live to Shadow Knight Game Zone!');
      setGameId('');
      setGameTitle('');
      setSubtitle('');
      setDescription('');
      setGameBundleUrl('');
    } catch (err) {
      setPublishMsg(err instanceof Error ? err.message : 'Failed to publish game.');
    } finally {
      setPublishingGame(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shadow Knight Owner Studio"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#120B24] border border-white/15 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-[#120B24]/98 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#00F0FF]" />
            <h2 className="font-display text-lg font-bold text-white">
              Owner Studio · Live Portal &amp; Cloud Games
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Owner Studio"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-7">
          {/* Portal Config Editor */}
          <form
            onSubmit={(e) => void handleSavePortalSettings(e)}
            className="rounded-xl bg-[#07070F]/80 border border-white/10 p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-display font-bold text-white">
              <Wrench className="w-4 h-4 text-[#00F0FF]" />
              <span>Live Portal Banner &amp; Support Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Welcome Announcement
                </label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={welcomeAnnouncement}
                  onChange={(e) => setWelcomeAnnouncement(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  WhatsApp Support Number
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Welcome Subtitle
              </label>
              <input
                type="text"
                maxLength={200}
                value={welcomeSubtitle}
                onChange={(e) => setWelcomeSubtitle(e.target.value)}
                className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-[#120B24] border border-white/10 px-3.5 py-2.5">
              <span className="text-xs font-semibold text-slate-200">
                Maintenance Mode (Shows maintenance screen to players)
              </span>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="w-5 h-5 accent-[#FF1E42] cursor-pointer"
              />
            </div>

            {maintenanceMode && (
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Maintenance Message
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {settingsMsg && (
                <span className="text-xs text-[#00F0FF] inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {settingsMsg}
                </span>
              )}
              <button
                type="submit"
                disabled={savingSettings}
                className="ml-auto min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#00F0FF] text-[#07070F] px-5 py-2.5 text-sm font-extrabold hover:brightness-110 transition cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : 'Save Live Config'}</span>
              </button>
            </div>
          </form>

          {/* Publish New Cloud Game */}
          <form
            onSubmit={(e) => void handlePublishGame(e)}
            className="rounded-xl bg-[#07070F]/80 border border-white/10 p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-display font-bold text-white">
              <CloudUpload className="w-4 h-4 text-[#FF1E42]" />
              <span>Publish New Cloud Game (HTTPS Bundle)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Game Title *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  placeholder="e.g. Neon Drift Overdrive"
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  URL Slug ID (optional)
                </label>
                <input
                  type="text"
                  maxLength={64}
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  placeholder="neon-drift-overdrive"
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Creator Studio *</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={creatorStudio}
                  onChange={(e) => setCreatorStudio(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GameMetadata['category'])}
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Hosted Game HTTPS URL *
              </label>
              <input
                type="url"
                required
                value={gameBundleUrl}
                onChange={(e) => setGameBundleUrl(e.target.value)}
                placeholder="https://your-game-host.example/index.html"
                className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Thumbnail HTTPS URL or /logo.png
                </label>
                <input
                  type="text"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Accent Theme</label>
                <select
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value as 'cyan' | 'crimson')}
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                >
                  <option value="cyan">Cyber Cyan</option>
                  <option value="crimson">Crimson Neon</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Short Subtitle</label>
                <input
                  type="text"
                  maxLength={100}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="High-speed 60fps arcade release"
                  className="w-full min-h-[40px] rounded-lg bg-[#120B24] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg bg-[#120B24] border border-white/10 px-3.5 py-2.5 self-end">
                <span className="text-xs font-semibold text-slate-200">
                  Force 16:9 Landscape Stage
                </span>
                <input
                  type="checkbox"
                  checked={isLandscapeOnly}
                  onChange={(e) => setIsLandscapeOnly(e.target.checked)}
                  className="w-5 h-5 accent-[#00F0FF] cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Description</label>
              <textarea
                rows={2}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Controls, mechanics, and objective..."
                className="w-full rounded-lg bg-[#120B24] border border-white/15 p-3 text-sm text-white focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {publishMsg && (
                <span className="text-xs text-[#00F0FF] inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {publishMsg}
                </span>
              )}
              <button
                type="submit"
                disabled={publishingGame}
                className="ml-auto min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] text-white px-5 py-2.5 text-sm font-extrabold transition cursor-pointer disabled:opacity-60"
              >
                <CloudUpload className="w-4 h-4" />
                <span>{publishingGame ? 'Publishing...' : 'Publish to Portal'}</span>
              </button>
            </div>
          </form>

          <p className="text-center text-[11px] text-slate-500">
            © 2026 Shadow Knight Game Zone. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
