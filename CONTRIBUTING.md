# Contributing to EasyTap Ride

Thank you for helping make everyday mobility simpler and safer for senior citizens and families!

## Great Ways to Contribute

- **Regional Language Support:** Add localized UI copy and voice-command keywords (e.g., Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, or international languages).
- **More Ride & Transit Providers:** Add deep-link templates in `src/data/presets.ts` for local auto/cab/metro services.
- **Accessibility Enhancements:** Improve screen-reader labels, high-contrast modes, or voice feedback.
- **Documentation & Guides:** Improve setup docs or add video/GIF walkthroughs.

## Local Development Workflow

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your own test Firebase project in `firebase-applet-config.json` (see `README.md`).
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Before opening a Pull Request, make sure all checks pass:
   ```bash
   npm run lint
   npm run build
   npx eslint firestore.rules
   ```

## Design Principles

- **Zero clutter for seniors:** Keep buttons large (`>= 44px` touch targets), labels plain, and avoid nested menus or developer jargon in the UI.
- **Zero billing:** Keep external services on free tiers with no mandatory paid APIs.
- **Privacy & Security:** Keep `firestore.rules` strict and synchronized with `firebase-blueprint.json`.
