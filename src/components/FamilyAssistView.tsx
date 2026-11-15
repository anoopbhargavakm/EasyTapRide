import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AssistMember, SharedElderAccount } from '../types';

interface FamilyAssistViewProps {
  ownProfileId: string;
  ownOwnerName: string;
  activeProfileId: string;
  activeOwnerName: string;
  assists: AssistMember[];
  elderAccounts: SharedElderAccount[];
  onSelectAccount: (profileId: string) => void;
  onAddAssist: (payload: {
    name: string;
    email: string;
    relationship: string;
  }) => Promise<void>;
  onRemoveAssist: (assist: AssistMember) => Promise<void>;
  onGoToAddPlaces: () => void;
}

export const FamilyAssistView: React.FC<FamilyAssistViewProps> = ({
  ownProfileId,
  ownOwnerName,
  activeProfileId,
  activeOwnerName,
  assists,
  elderAccounts,
  onSelectAccount,
  onAddAssist,
  onRemoveAssist,
  onGoToAddPlaces,
}) => {
  const isAssistingOther = Boolean(
    ownProfileId && activeProfileId && activeProfileId !== ownProfileId
  );

  const [mobileTab, setMobileTab] = useState<'helpers' | 'accounts'>(
    isAssistingOther ? 'accounts' : 'helpers'
  );

  const [assistName, setAssistName] = useState('');
  const [assistEmail, setAssistEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [lastAddedShare, setLastAddedShare] = useState<{
    name: string;
    email: string;
  } | null>(null);

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [listError, setListError] = useState('');

  useEffect(() => {
    setConfirmRemoveId(null);
    setListError('');
  }, [activeProfileId]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = assistName.trim();
    const cleanEmail = assistEmail.trim().toLowerCase();
    if (!cleanName) {
      setFormError('Please enter their name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter their Gmail address (e.g. name@gmail.com).');
      return;
    }

    setSaving(true);
    setFormError('');
    setLastAddedShare(null);
    try {
      await onAddAssist({
        name: cleanName,
        email: cleanEmail,
        relationship: 'Family Helper',
      });
      setLastAddedShare({ name: cleanName, email: cleanEmail });
      setAssistName('');
      setAssistEmail('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add helper.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemove = async (assist: AssistMember) => {
    setListError('');
    try {
      await onRemoveAssist(assist);
      setConfirmRemoveId(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not remove helper.');
    }
  };

  const buildWhatsAppShareUrl = (shareName: string, shareEmail: string) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `Hi ${shareName}, I added you as my helper on EasyTap Ride. Open ${appUrl} on your phone and sign in with Google (${shareEmail}) to add places to my account.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const renderMyHelpersPanel = () => {
    if (isAssistingOther) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 gap-4">
          <p className="text-base text-[#3D4440] leading-relaxed">
            You are currently adding places for <strong>{activeOwnerName}</strong>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onGoToAddPlaces}
              className="min-h-[48px] px-5 rounded-xl bg-[#1B4D3E] text-white text-base font-semibold cursor-pointer"
            >
              Add Places for {activeOwnerName}
            </button>
            <button
              type="button"
              onClick={() => onSelectAccount(ownProfileId)}
              className="min-h-[48px] px-5 rounded-xl border border-[#DCD8CE] text-base font-semibold text-[#171A18] cursor-pointer"
            >
              Back to My Account
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-4 lg:overflow-y-auto">
        <form onSubmit={handleAddSubmit} className="space-y-3 shrink-0">
          <div className="space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-[#171A18]">
              Let someone add places for you
            </h2>
            <p className="text-sm text-[#4A524D]">
              Enter their name and Gmail. When they sign in on their phone, they can add places to your account.
            </p>
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-semibold text-[#171A18] mb-1">
              Their Name
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Rahul"
              value={assistName}
              onChange={(e) => setAssistName(e.target.value)}
              className="block w-full min-w-0 max-w-full box-border min-h-[48px] px-3.5 rounded-xl border border-[#D4D0C5] bg-[#F7F6F2] text-base text-[#171A18] placeholder:text-[#7A827D]"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-semibold text-[#171A18] mb-1">
              Their Gmail Address
            </label>
            <input
              type="email"
              required
              maxLength={200}
              placeholder="e.g. rahul@gmail.com"
              value={assistEmail}
              onChange={(e) => setAssistEmail(e.target.value)}
              className="block w-full min-w-0 max-w-full box-border min-h-[48px] px-3.5 rounded-xl border border-[#D4D0C5] bg-[#F7F6F2] text-base text-[#171A18] placeholder:text-[#7A827D]"
            />
          </div>

          {formError && <p className="text-sm font-medium text-[#B91C1C] break-words">{formError}</p>}

          {lastAddedShare && (
            <div className="bg-[#EEF5F2] border border-[#1B4D3E]/30 rounded-xl p-3 space-y-2">
              <p className="text-sm font-medium text-[#1B4D3E]">
                Done! Ask <strong>{lastAddedShare.name}</strong> to open EasyTap Ride and sign in with{' '}
                <strong>{lastAddedShare.email}</strong>.
              </p>
              <a
                href={buildWhatsAppShareUrl(lastAddedShare.name, lastAddedShare.email)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-3.5 rounded-lg bg-[#1B4D3E] text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Send link on WhatsApp</span>
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] disabled:opacity-60 text-white font-semibold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
            <span>{saving ? 'Adding...' : 'Allow to Add Places'}</span>
          </button>
        </form>

        {/* People Who Can Help You */}
        <div className="pt-3 border-t border-[#E2DFD7] space-y-2">
          <h3 className="text-sm font-semibold text-[#171A18]">
            People who can help you ({assists.length})
          </h3>
          {listError && <p className="text-sm font-medium text-[#B91C1C]">{listError}</p>}

          {assists.length === 0 ? (
            <p className="text-sm text-[#4A524D] bg-[#F7F6F2] rounded-xl p-3">
              No one added yet.
            </p>
          ) : (
            <div className="divide-y divide-[#EEECE6]">
              {assists.map((assist) => {
                const isConfirming = confirmRemoveId === assist.id;
                return (
                  <div
                    key={assist.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-base text-[#171A18] truncate">
                        {assist.name}
                      </div>
                      <div className="text-sm text-[#4A524D] truncate">{assist.email}</div>
                    </div>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConfirmRemove(assist)}
                          className="min-h-[42px] px-3 rounded-xl bg-[#B91C1C] text-white text-sm font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="min-h-[42px] px-3 rounded-xl border border-[#DCD8CE] text-sm font-semibold cursor-pointer"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(assist.id)}
                        aria-label={`Remove ${assist.name}`}
                        className="min-h-[44px] px-3 rounded-xl border border-[#DCD8CE] hover:bg-[#FEF2F2] text-[#B91C1C] text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAccountsPanel = () => (
    <div className="flex-1 min-h-0 flex flex-col gap-3 lg:overflow-hidden">
      <div className="space-y-1 shrink-0">
        <div className="flex items-center gap-2 font-display text-lg sm:text-xl font-semibold text-[#171A18]">
          <Users className="w-5 h-5 text-[#1B4D3E] shrink-0" />
          <span>Accounts I Help ({elderAccounts.length})</span>
        </div>
        <p className="text-sm text-[#4A524D]">
          If a family member added your Gmail on their phone, tap their name below to add places for them.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 ${
            !isAssistingOther
              ? 'bg-[#EEF5F2] border-[#1B4D3E]'
              : 'bg-[#FAF9F6] border-[#DCD8CE]'
          }`}
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#1B4D3E]">My Account</div>
            <div className="font-semibold text-base text-[#171A18] truncate">
              {ownOwnerName}
            </div>
          </div>
          {!isAssistingOther ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4D3E] shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              <span>Active</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onSelectAccount(ownProfileId)}
              className="min-h-[44px] px-4 rounded-xl bg-white border border-[#D4D0C5] hover:border-[#1B4D3E] text-sm font-semibold text-[#171A18] cursor-pointer shrink-0"
            >
              Switch Back
            </button>
          )}
        </div>

        {elderAccounts.map((elder) => {
          const isActive = activeProfileId === elder.profileId;
          return (
            <div
              key={elder.profileId}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 ${
                isActive
                  ? 'bg-[#EEF5F2] border-[#1B4D3E]'
                  : 'bg-[#FAF9F6] border-[#DCD8CE]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs text-[#4A524D] truncate">
                  {elder.ownerEmail || 'Shared account'}
                </div>
                <div className="font-semibold text-base text-[#171A18] truncate">
                  {elder.ownerName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectAccount(elder.profileId);
                  onGoToAddPlaces();
                }}
                className="min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-sm font-semibold shrink-0 cursor-pointer"
              >
                Add Places
              </button>
            </div>
          );
        })}

        {elderAccounts.length === 0 && (
          <p className="text-sm text-[#4A524D] bg-[#F7F6F2] rounded-xl p-3.5 leading-relaxed">
            No shared accounts yet. When someone enters your Gmail under <strong>Assist</strong> on their device, their account appears here automatically.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden">
      {/* Mobile 2-Tab Card */}
      <section className="lg:hidden flex-1 min-h-0 bg-white border border-[#DCD8CE] rounded-2xl p-4 flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-1 p-1 bg-[#F7F6F2] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('helpers')}
            className={`flex-1 min-h-[44px] px-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              mobileTab === 'helpers' ? 'bg-white text-[#171A18] shadow-xs' : 'text-[#4A524D]'
            }`}
          >
            My Helpers ({assists.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('accounts')}
            className={`flex-1 min-h-[44px] px-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              mobileTab === 'accounts' ? 'bg-white text-[#171A18] shadow-xs' : 'text-[#4A524D]'
            }`}
          >
            Who I Help ({elderAccounts.length})
          </button>
        </div>

        {mobileTab === 'helpers' ? renderMyHelpersPanel() : renderAccountsPanel()}
      </section>

      {/* Desktop 2-Column Side-by-Side View */}
      <div className="hidden lg:grid lg:grid-cols-2 flex-1 min-h-0 gap-4 overflow-hidden">
        <section className="bg-white border border-[#DCD8CE] rounded-2xl p-5 flex flex-col overflow-hidden">
          {renderMyHelpersPanel()}
        </section>

        <section className="bg-white border border-[#DCD8CE] rounded-2xl p-5 flex flex-col overflow-hidden">
          {renderAccountsPanel()}
        </section>
      </div>
    </div>
  );
};
