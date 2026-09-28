# SpliceGuard Project Rules

## Project Structure
- This is a Vite + React + TypeScript app. Keep page-level workflows in `src/pages/` and reusable UI in `src/components/`.
- `src/App.tsx` selects the active page; shared application state and actions belong in `src/context/AppContext.tsx`.
- Shared domain types are in `src/types/index.ts`; demo fixtures are in `src/data/mockData.ts`. Keep both aligned when changing data shapes.
- The Copilot UI and client are under `src/components/` and `src/services/copilotService.ts`. Its Express backend is in `server/`, split into intent classification, context construction, and memory modules.
- `vite.config.ts` mounts the Express backend into the Vite dev server for `/api/copilot` requests. Preserve this integration when changing local API behavior.
- Digital Twin page-specific UI is under `src/components/digital-twin/`; check existing canvas/viewport boundaries before adding rendering logic.

## Commands
- `npm run dev` starts Vite on port 3000 and serves the integrated Copilot API.
- `npm run lint` runs `tsc --noEmit`; use it as the TypeScript validation check.
- `npm run build` creates the production frontend build.
- There is no test script currently defined in `package.json`; do not report tests as run unless a separate test command is added and executed.

## Domain and Data Integrity
- Treat this as industrial condition-monitoring software, not an equipment control system. The Copilot may explain evidence and recommend review or maintenance, but must not be represented as commanding, starting, stopping, or overriding conveyor safety controls.
- Do not invent telemetry, splice IDs, locations, confidence, remaining useful life, inventory, costs, or universal thresholds. Use supplied data and label observations, model inferences, and predictions distinctly.
- Preserve the distinction between RFID identity, encoder position, external vision evidence, internal MFL/DMI evidence, thermal/acoustic signals, and operating context.
- Keep Gemini credentials server-side via environment variables (`GEMINI_API_KEY`; legacy `VITE_GEMINI_API_KEY` is also read by the backend). Never add secrets to source, client bundles, or committed config.

## Change Guidance
- Follow the existing React/TypeScript and Tailwind conventions in the neighboring component or page; avoid unrelated refactors.
- When changing shared state, domain types, or Copilot request/response shapes, trace the corresponding consumers across `src/` and `server/` and keep both sides compatible.
- For UI changes, preserve the existing operational dashboard layout and responsive behavior.