# Brooke — AI Export Intelligence

**Brooke** is an AI-powered market intelligence and export platform that helps **Sri Lankan SMEs** sell internationally. It combines trade data, AI-driven HS-code classification, compliance guidance, and a verified B2B marketplace in one place.

> AI-powered market intelligence, HS code classification, compliance tracking, and a verified B2B marketplace for Sri Lankan SMEs.

---

## Features

- **Market intelligence** — Explore export markets using ITC Trade Map, World Bank WITS, and WTO tariff data.
- **HS code classification** — Classify products with AI assistance (Google AI / Gemini).
- **Compliance tracking** — Track export requirements and documentation.
- **Verified B2B marketplace** — Browse listings, create product listings (SME owners), and message counterparties.
- **Cart, checkout & orders** — Buyers can purchase; SME owners manage sales.
- **Role-based access control** — Dedicated flows for **SME owners**, **buyers**, and **admins**.
- **Company verification & audit logs** — Admin tools to verify companies and review audit trails.
- **Real-time insights & notifications** — Live dashboard updates and in-app notifications.
- **Internationalization** — Multi-language UI via `i18next`, with light/dark themes and live forex rates.
- **Analytics** — Product analytics through PostHog.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS 4, Radix UI, `class-variance-authority`, `tailwind-merge` |
| Routing & data | React Router 7, TanStack Query |
| Forms & validation | React Hook Form, Zod |
| Visualization | Recharts, Framer Motion, React Leaflet / Leaflet |
| i18n | i18next, react-i18next |
| Backend | [InsForge](https://insforge.dev) (Postgres, Auth, Storage, Functions, Realtime) via `@insforge/sdk` |
| Analytics | PostHog |

## Getting Started

### Prerequisites

- Node.js **22+**
- npm
- An [InsForge](https://insforge.dev) project (for auth, database, storage)

### Installation

```bash
npm install
cp .env.example .env
```

Fill in the values in `.env` (see [Environment variables](#environment-variables)).

### Development

```bash
npm run dev
```

### Build & preview

```bash
npm run build
npm run preview
```

### Quality checks

```bash
npm run lint      # ESLint
npx tsc --noEmit  # Type check
npm test          # Vitest
```

## Environment Variables

All client-exposed variables are prefixed with `VITE_` (see `src/vite-env.d.ts`). Never commit `.env` or `.env.local`.

| Variable | Description |
| --- | --- |
| `VITE_INSFORGE_PROJECT_ID` | InsForge project ID |
| `VITE_INSFORGE_ANON_KEY` | InsForge public anon key |
| `VITE_GOOGLE_AI_API_KEY` | Google AI (Gemini) API key |
| `VITE_GOOGLE_AI_MODEL` | Google AI model name |
| `VITE_WTO_API_KEY` | WTO API key |
| `VITE_WTO_API_BASE_URL` | WTO API base URL |
| `VITE_WITS_BASE_URL` | World Bank WITS API base URL |
| `VITE_ITC_INTEGRATION_MODE` | ITC integration mode (e.g. `manual_export`) |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | PostHog analytics (optional) |

## Project Structure

```
src/
├── components/   # UI components, layout, shared widgets
├── contexts/     # Auth, Cart, Forex, I18n, Theme providers
├── hooks/        # Reusable hooks
├── lib/          # API clients (InsForge, WTO, WITS, ITC, AI insights, analytics)
├── pages/        # landing, auth, dashboard
├── test/         # Vitest + RBAC e2e tests
├── types/        # Shared TypeScript types
└── main.tsx      # App entry + routes
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs **lint → typecheck → test → build** on pushes and pull requests to `main`/`develop`. Pushes to `main` additionally deploy to InsForge.

## License

Private / proprietary. All rights reserved.