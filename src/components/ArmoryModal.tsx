import React from 'react';
import { Check, Coins, Shield, Sparkles, Sword, X, Zap } from 'lucide-react';
import { ARMORY_PERKS, ARMORY_SKINS } from '../config/armory';
import type { ArmoryPerkId, ArmorySkinId, PlayerProfile } from '../types';

interface ArmoryModalProps {
  isOpen: boolean;
  profile: PlayerProfile;
  onClose: () => void;
  onSelectOrUnlockSkin: (skinId: ArmorySkinId, cost: number) => void;
  onUnlockPerk: (perkId: ArmoryPerkId, cost: number) => void;
}

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSelectOrUnlockSkin,
  onUnlockPerk,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shadow Knight Armory and Coin Shop"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#120B24] border border-white/12 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-[#120B24]/98 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Sword className="w-5 h-5 text-[#00F0FF]" />
            <h2 className="font-display text-lg font-bold text-white">
              Knight Armory &amp; Upgrades
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-400/35 px-3 py-1.5 font-mono-nums text-sm font-bold text-amber-300">
              <Coins className="w-4 h-4" />
              <span>{profile.coins.toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Armory"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-7">
          {/* Blade & Armor Skins */}
          <section>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-display text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00F0FF]" />
                <span>Blade &amp; Armor Skins (Chrono Slayer 3D + Reflex Trail)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {ARMORY_SKINS.map((skin) => {
                const isUnlocked = profile.unlockedSkins.includes(skin.id);
                const isEquipped = profile.equippedSkin === skin.id;
                const canAfford = profile.coins >= skin.cost;

                return (
                  <div
                    key={skin.id}
                    className={`rounded-xl border p-4 transition ${
                      isEquipped
                        ? 'bg-[#07070F] border-[#00F0FF]/70 shadow-lg'
                        : 'bg-[#07070F]/75 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-9 h-9 rounded-lg border border-white/20 shrink-0 shadow-inner"
                          style={{
                            background: `linear-gradient(135deg, ${skin.accentCss}, ${skin.secondaryCss})`,
                          }}
                        />
                        <div>
                          <div className="font-display text-sm font-bold text-white">
                            {skin.name}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-300 leading-snug">
                            {skin.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="font-mono-nums text-xs font-semibold text-amber-300">
                        {skin.cost === 0 ? 'Starter Gear' : `${skin.cost} Coins`}
                      </span>

                      <button
                        type="button"
                        disabled={isEquipped || (!isUnlocked && !canAfford)}
                        onClick={() => onSelectOrUnlockSkin(skin.id, skin.cost)}
                        className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default'
                            : isUnlocked
                            ? 'bg-[#00F0FF] text-[#07070F] hover:brightness-110'
                            : canAfford
                            ? 'bg-[#FF1E42] text-white hover:bg-[#ff3355]'
                            : 'bg-white/8 text-slate-500 border border-white/10 cursor-not-allowed'
                        }`}
                      >
                        {isEquipped ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Equipped
                          </span>
                        ) : isUnlocked ? (
                          'Equip Skin'
                        ) : canAfford ? (
                          `Unlock (${skin.cost})`
                        ) : (
                          `Need ${skin.cost - profile.coins} more`
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Permanent Arena Perks */}
          <section>
            <h3 className="font-display text-sm sm:text-base font-bold text-white flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#FF1E42]" />
              <span>Permanent Arena Perks</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {ARMORY_PERKS.map((perk) => {
                const isUnlocked = profile.unlockedPerks.includes(perk.id);
                const canAfford = profile.coins >= perk.cost;

                return (
                  <div
                    key={perk.id}
                    className={`rounded-xl border p-4 flex flex-col justify-between ${
                      isUnlocked
                        ? 'bg-[#07070F] border-emerald-400/45'
                        : 'bg-[#07070F]/75 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-mono-nums text-[11px] font-bold"
                          style={{ color: perk.accentCss }}
                        >
                          {perk.badgeText}
                        </span>
                        <Zap className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                      <h4 className="mt-1.5 font-display text-sm font-bold text-white">
                        {perk.name}
                      </h4>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                        {perk.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isUnlocked || !canAfford}
                      onClick={() => onUnlockPerk(perk.id, perk.cost)}
                      className={`mt-4 min-h-[42px] w-full rounded-xl px-4 py-2 text-xs font-extrabold transition cursor-pointer ${
                        isUnlocked
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default'
                          : canAfford
                          ? 'bg-[#FF1E42] hover:bg-[#ff3355] text-white'
                          : 'bg-white/8 text-slate-500 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {isUnlocked
                        ? 'Active Forever'
                        : canAfford
                        ? `Unlock · ${perk.cost} Coins`
                        : `${perk.cost} Coins Required`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="text-center text-[11px] text-slate-500">
            © 2026 Shadow Knight Game Zone. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
