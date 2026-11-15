# EasyTap Ride

A senior-friendly, minimal-tap ride booking Progressive Web App (PWA) with voice booking, one-tap Emergency SOS, and effortless Gmail-based family assistance—running **100% free** on Firebase Spark + Vercel.

---

## Why EasyTap Ride?

Booking a ride shouldn't require typing addresses, navigating nested menus, or copying invite codes. EasyTap Ride turns frequent destinations (**Home**, **Hospital**, **Temple**, etc.) into large, high-contrast tap cards that launch ride apps with pickup and drop-off already filled in.

---

## Key Features

- **One-Tap Ride Booking (`Easy Ride`)**
  - Tap a saved place → pick **Auto** or **Cab** → launch **Namma Yatri**, **Rapido**, **Uber**, or **Ola** with pickup GPS and drop-off location pre-filled.
  - Built-in **Open Location Code (Plus Code)** decoder (`8-char` full and `4-char` local shortcodes) and street-adjusted fare estimates.
- **Voice Booking**
  - Tap **Voice** and speak naturally (e.g., *"Book Auto to Hospital"* or *"Cab to Home via Uber"*) using browser Speech Recognition (`en-IN`) with fuzzy matching.
- **Calibrated GPS & One-Tap Emergency SOS**
  - Collects multiple high-accuracy GPS readings for reliable pickup coordinates.
  - **Emergency** modal offers instant one-tap **Call** (`tel:`), **Send Location SMS** (`sms:` with Google Maps pin), **WhatsApp** share, and **Copy Message**.
- **Simple Gmail Family Assist (`Assist`)**
  - Enter a trusted helper's **Name** and **Gmail address**—no invite codes, links, or spreadsheets.
  - When that helper signs in with Google on their own phone, your account appears under **Who I Help** so they can add, edit, or pin places for you remotely in real time.
- **Installable Offline-Ready PWA**
  - Installable on Android, iOS, and desktop (`vite-plugin-pwa` + Workbox) with offline banner support for cached places and SOS contacts.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Auth & Real-Time Database:** Firebase Authentication (Google Sign-In) + Cloud Firestore (Spark free tier)
- **PWA:** `vite-plugin-pwa` (Workbox precache + standalone manifest)
- **Hosting:** Static SPA build (`dist/`) — works on **Vercel**, Netlify, Cloudflare Pages, or Node/Express (`server.ts`)

---

## Project Structure

```text
├── firebase-applet-config.json   # Client Firebase project configuration
├── firebase-blueprint.json       # Firestore data model specification
├── firestore.rules               # Hardened Firestore security rules
├── firestore.rules.test.ts       # Adversarial security rule test payloads
├── security_spec.md              # Access-control invariants & audit spec
├── vercel.json                   # Vercel SPA rewrite & SW cache headers
├── public/                       # PWA icons (192x192, 512x512, maskable, Apple)
└── src/
    ├── App.tsx                   # Auth lifecycle, Firestore listeners, navigation
    ├── types.ts                  # Shared TypeScript models
    ├── components/
    │   ├── EasyRideView.tsx      # Tap-to-book cards, voice & Emergency SOS modal
    │   ├── SavedPlacesView.tsx   # Add/edit/pin places & Emergency SOS contact
    │   ├── FamilyAssistView.tsx  # 2-field helper sharing & Who I Help switcher
    │   ├── GoogleSignInGate.tsx  # Clean Google sign-in landing card
    │   └── PWAInstallButton.tsx  # Native install prompt + iOS Safari guide
    ├── data/
    │   └── presets.ts            # Plus Code decoder, deep-links, voice parser, SOS
    ├── hooks/
    │   └── usePWAInstall.ts      # beforeinstallprompt & online/offline hooks
    └── lib/
        ├── firebaseAuth.ts       # Firebase app, Firestore & Google Auth setup
        ├── firestoreStore.ts     # Real-time subscriptions & atomic batch writes
        └── preciseLocation.ts    # Multi-sample GPS calibration utility
```

---

## Self-Hosting / Running Locally

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/easytap-ride.git
cd easytap-ride
npm install
```

### 2. Connect Your Own Free Firebase Project

If you are forking this repo for your own deployment, point it at your own Firebase project (Spark free tier):

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Sign-in method → Google**.
3. Create a **Cloud Firestore** database.
4. Register a **Web App** in Project Settings and update `firebase-applet-config.json` with your `projectId`, `appId`, `apiKey`, `authDomain`, `firestoreDatabaseId` (use `"(default)"` for standard Firestore databases), `storageBucket`, and `messagingSenderId`.
5. Deploy the security rules from `firestore.rules` to your Firebase project:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```
   > **Security Note:** Review `firestore.rules` before sharing your deployment broadly to confirm the access rules fit your use case.

### 3. Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

### 4. Type-Check, Lint Rules & Build

```bash
npm run lint
npx eslint firestore.rules
npm run build
```

---

## Deploying to Vercel (Free)

1. Push your repository to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new) (no environment variables needed; `vercel.json` is already configured for Vite + SPA routing).
3. Copy your deployed Vercel hostname (e.g. `your-app.vercel.app`) and add it under **Firebase Console → Authentication → Settings → Authorized domains** so Google Sign-In works on your live URL.

---

## License

Released under the [MIT License](./LICENSE).
