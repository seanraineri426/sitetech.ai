# SiteTech Product App

AI layer above construction software (Procore, Microsoft 365, etc.).

This is the product application (app.sitetech.ai), not the marketing site.

**Current status:** Task 1 of Milestone 1 — Base scaffold

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (or npm)

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Scripts

- `pnpm dev` — Start development server
- `pnpm build` — Build for production
- `pnpm start` — Start production server
- `pnpm typecheck` — Run TypeScript type checking
- `pnpm lint` — Run ESLint
- `pnpm test` — Run tests
- `pnpm test:watch` — Run tests in watch mode

## Environment Variables

Currently no required environment variables. When integrations are added in later tasks:

- Supabase credentials (Task 2)
- Procore API keys (Task 3+)
- Inngest event key (Task 4+)
- LLM provider keys (Task 5+)

## API Endpoints

- `GET /api/health` — Health check endpoint (returns `{ ok: true }`)

## Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Testing:** Vitest
- **Linting:** ESLint
- **Package Manager:** pnpm
- **Environment Validation:** Zod

## Project Structure

```
app/
  api/health/          # Health check endpoint
  layout.tsx           # Root layout
  page.tsx             # Homepage
  globals.css          # Global styles
lib/
  env.ts               # Environment variable validation
```

## CI

GitHub Actions workflow runs on push and PR:
- Type checking
- Linting
- Tests

## What's Next

- Task 2: Supabase integration
- Task 3: Authentication
- Task 4: Inngest event handling
- Task 5: Procore integration
- Task 6+: LLM features
