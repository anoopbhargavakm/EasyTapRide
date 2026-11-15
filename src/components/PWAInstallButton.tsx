import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (isInstalled) {
    return null;
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '/';
  const inIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border border-[#D4D0C5] bg-white hover:border-[#1B4D3E] text-[#171A18] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1B4D3E] shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1B4D3E] shrink-0" />
        )}
        <span>{isInstallable ? 'Install App' : 'Mobile App'}</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Mobile Web App"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E2DFD7] rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-semibold text-[#171A18]">
                  Add EasyTap Ride to Phone
                </h2>
                <p className="text-xs sm:text-sm text-[#5A635E]">
                  Install as a full-screen mobile web app on your home screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#171A18] hover:bg-[#F7F6F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm text-[#171A18]">
              {isIOS ? (
                <div className="bg-[#F7F6F2] rounded-xl p-3.5 space-y-1.5">
                  <p className="font-semibold">On iPhone / iPad (Safari):</p>
                  <p className="text-xs sm:text-sm text-[#3D4440]">
                    1. Tap the <strong>Share</strong> icon in Safari.<br />
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-[#F7F6F2] rounded-xl p-3.5 space-y-1">
                    <p className="font-semibold">On Android (Chrome):</p>
                    <p className="text-xs sm:text-sm text-[#3D4440]">
                      Tap the <strong>⋮</strong> browser menu and select{' '}
                      <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </p>
                  </div>
                  <div className="bg-[#F7F6F2] rounded-xl p-3.5 space-y-1">
                    <p className="font-semibold">On iPhone / iPad (Safari):</p>
                    <p className="text-xs sm:text-sm text-[#3D4440]">
                      Tap <strong>Share</strong> and select{' '}
                      <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {inIframe && (
                <a
                  href={appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <span>Open in Browser</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 min-h-[44px] px-4 rounded-xl border border-[#D4D0C5] hover:bg-[#F7F6F2] text-sm font-semibold text-[#171A18] inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-[#1B4D3E]" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy App Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
