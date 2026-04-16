# Copilot Instructions for MacroPal

## Build, test, and lint commands

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Build web app: `npm run build`
- Lint all files: `npm run lint`
- Lint a single file: `npm run lint -- src/pages/home/Home.tsx`
- Unit tests (watch mode): `npm run test.unit`
- Unit tests (single run): `npm run test.unit.run`
- Run one unit test file: `npm run test.unit.run -- src/utils/validation.test.ts`
- Run one unit test by name: `npm run test.unit.run -- -t "validateEmail"`
- Cypress E2E tests: `npm run test.e2e`
- Run one Cypress spec: `npm run test.e2e -- --spec cypress/e2e/app.cy.ts`
- CI-style validation: `npm run check`
- Combined local runner (bash script): `npm run test.all`
- Firebase Functions build: `npm --prefix functions run build`

## High-level architecture

- **App shell and routing:** `src/main.tsx` initializes platform setup and Ionic PWA elements before rendering. `src/App.tsx` owns route wiring with a root `IonRouterOutlet` plus tabbed routes inside `IonTabs`/`IonRouterOutlet` under `/app`.
- **Runtime config and feature gating:** `src/UpdateGate.tsx` fetches `meta/appConfig` from Firestore, enforces maintenance/update gates, and exposes feature flags via `useRemoteConfig` + `isFeatureEnabled` (used in `App.tsx`, `pages/AddFood.tsx`, and `components/DebugOverlay.tsx`).
- **Data access layer:** `src/firebase.ts` centralizes Firebase initialization (Auth + IndexedDB persistence, Firestore persistent cache + long polling, Storage, Analytics `trackEvent`). Most feature pages read/write under `users/{uid}` and day-scoped subdocs (for example `foods/{dateKey}`, `workouts/{dateKey}`, `weighins/{dateKey}`).
- **Demo mode path:** `VITE_DEMO_MODE=true` activates `DemoProvider` + `DemoMode` + `DemoRouter` and bypasses normal auth flow. Demo persistence is localStorage-backed via `src/utils/demoFirestore.ts`, with seed data from `src/utils/demoDataSeed.ts`.
- **Backend services:** `functions/src/index.ts` hosts Firebase Functions for Open Food Facts proxy endpoints (`offBarcode`, `offSearch`) and a Firestore trigger (`updateStreakCache`) that updates user streak metadata when food docs change.
- **Standalone admin tool:** `admin-app/` is a separate static Firestore editor for manual data operations and is not part of the Vite/Ionic bundle.

## Key conventions

- **Route additions follow a 4-step pattern in `src/App.tsx`:** add `const importX = () => import(...)`, add `const X = lazy(importX)`, add `importX` to `LAZY_ROUTE_IMPORTS`, then register the `<Route>` in the correct outlet (`root` or tab outlet).
- **Use `src/utils/date.ts` helpers for date keys** (`todayDateKey`, `toDateKey`, `shiftDateKey`) and keep all writes/reads in a feature on the same `YYYY-MM-DD` key strategy.
- **Preserve demo/real parity:** when changing Firestore/auth flows, keep demo-mode behavior aligned (see `useProfile`, `useDemoFirestore`, and `Home`/`AddFood` branches on `VITE_DEMO_MODE`).
- **Use centralized error and validation utilities:** prefer `handleError` (`src/utils/handleError.ts`) for surfaced async failures and `validation.ts` / `typeGuards.ts` for runtime input/data checks.
- **Use theme tokens, not ad-hoc colors:** shared styling is driven by `--mp-*` CSS variables in `src/theme/theme.css` with dark-mode overrides on `body.dark`. Keep import order from `src/main.tsx` (`variables.css` then `theme.css`).
