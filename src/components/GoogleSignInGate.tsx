import React from 'react';
import { MapPin, ShieldAlert, Users } from 'lucide-react';

interface GoogleSignInGateProps {
  loading: boolean;
  error: string;
  onSignIn: () => void;
}

export const GoogleSignInGate: React.FC<GoogleSignInGateProps> = ({
  loading,
  error,
  onSignIn,
}) => {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-[#E2DFD7] rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#171A18] tracking-tight text-balance">
            Book rides in one tap
          </h1>
          <p className="text-base text-[#4A524D] leading-relaxed">
            A simple ride companion made for seniors—tap a saved place or use your voice to book an auto or cab right away.
          </p>
        </div>

        <ul className="space-y-3 text-sm sm:text-base text-[#171A18] border-t border-b border-[#EEECE6] py-4">
          <li className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#1B4D3E] shrink-0" />
            <span>Save Home, Hospital, and frequent places once</span>
          </li>
          <li className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#1B4D3E] shrink-0" />
            <span>Let family members add and update places for you</span>
          </li>
          <li className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-[#B91C1C] shrink-0" />
            <span>One-tap Emergency SOS call &amp; location share</span>
          </li>
        </ul>

        {error && (
          <p className="text-sm font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 break-words">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={onSignIn}
          className="w-full min-h-[54px] px-5 rounded-xl bg-white hover:bg-[#F7F6F2] border border-[#747775] text-[#1F1F1F] font-semibold text-base inline-flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60"
        >
          <span className="w-5 h-5 shrink-0 inline-block">
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="block w-full h-full"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
          </span>
          <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>
      </div>
    </div>
  );
};
