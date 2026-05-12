# MacroPal

MacroPal is a nutrition and fitness tracker built with **React + Ionic + Capacitor + Firebase** for web, Android, and iOS.

## What it does

- Food logging (search, barcode, custom foods, favorites, templates)
- Macro + calorie analytics and weight tracking
- Workout logging
- Optional AI-assisted photo food recognition (via Firebase Functions)
- Demo Mode for presentations (local demo data, auto-reset flow)
- Clinician collaboration (feature-flagged)

## Auth and account notes

- Email/password and Google sign-in
- MFA support (SMS/TOTP)
- Device-friendly auth flow improvements (OTP autofill and verification handling)
- Optional device credential/passkey-style Google flow on supported platforms

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

### Required env values

- `VITE_FIREBASE_API_KEY`
- `VITE_GOOGLE_WEB_CLIENT_ID`

For AI photo recognition through cloud proxy:

- Firebase Functions secret: `GOOGLE_VISION_API_KEY`

## Demo Mode (presentation)

1. Put demo video at `public/assets/demo-loop.mp4`
2. Set `VITE_DEMO_MODE=true` in `.env`
3. Run/build normally

## Main scripts

- `npm run dev` — local app
- `npm run build` — production web build
- `npm run lint` — lint
- `npm run test.unit.run` — unit tests (single run)
- `npm run test.e2e` — Cypress E2E (requires local dev server)
- `npm run check` — lint + build + unit tests
- `npm run test.all` — local combined checks

## Project structure

- `src/` app code (pages, components, hooks, utils, theme)
- `functions/` Firebase Functions (API proxies + automations)
- `android/`, `ios/` native Capacitor projects
- `admin-app/` standalone admin utility

## Build mobile apps

```bash
npm run build
npx cap sync android
npx cap open android
```

```bash
npm run build
npx cap sync ios
npx cap open ios
```

## Contributing

1. Create a branch
2. Make focused changes
3. Run `npm run check`
4. Open a PR

## License

MIT (see `LICENSE`)
