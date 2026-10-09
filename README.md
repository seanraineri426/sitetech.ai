# SiteTech Product App

AI layer above construction software (Procore, Microsoft 365, etc.).

This is the product application (app.sitetech.ai), not the marketing site.

**Current status:** Task 1 of Milestone 1 — Base scaffold

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (or npm)
- Docker (for local Supabase)

### Installation

```bash
# Install dependencies
pnpm install
```

### Supabase Setup (Local Development)

1. Start the local Supabase stack:

```bash
pnpm supabase start
```

This will start PostgreSQL, Auth, Storage, and other Supabase services in Docker containers.

2. The output will show your local Supabase credentials. Copy the `API URL` and `anon key`.

3. Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

4. Update `.env.local` with your local Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-start
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase-start
```

5. Apply the migrations:

```bash
pnpm supabase db reset
```

This creates the initial schema with multi-tenant tables and RLS policies.

6. Access Supabase Studio at http://127.0.0.1:54323 to view your database.

### Stopping Supabase

```bash
pnpm supabase stop
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
- `pnpm test:db:nodocker` — Run database tests against local Supabase (no Docker needed)
- `pnpm supabase start` — Start local Supabase (requires Docker)
- `pnpm supabase stop` — Stop local Supabase

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### Supabase Configuration

**Local development (with Supabase CLI):**

1. Start local Supabase:
   ```bash
   pnpm supabase start
   ```

2. Copy the API URL and anon key from the output to your `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-local-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key>
   ```

3. For local magic-link testing, emails are caught by Inbucket (included in Supabase local stack):
   - Open [http://127.0.0.1:54324](http://127.0.0.1:54324) to view test emails
   - Click the magic link in the email to sign in

**Hosted Supabase:**

1. Get your project credentials from [Supabase Dashboard](https://app.supabase.com):
   - Project Settings → API
   - Copy `Project URL` and `anon/public` key

2. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

3. Configure Auth redirect URLs in Supabase Dashboard:
   - Authentication → URL Configuration
   - Add to "Redirect URLs":
     - Local: `http://127.0.0.1:54321/auth/v1/callback`
     - Production: `https://<project-ref>.supabase.co/auth/v1/callback`
     - Your app domain: `https://yourdomain.com/auth/callback`

### Microsoft (Azure AD) Sign-In (Optional)

To enable Microsoft sign-in:

1. Set the environment variable:
   ```
   NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true
   ```

2. Configure Azure AD OAuth in Supabase:
   - Follow [Supabase Azure AD guide](https://supabase.com/docs/guides/auth/social-login/auth-azure)
   - Add Azure AD application credentials to your Supabase project
   - No additional environment variables needed in the app (handled by Supabase)

See `.env.example` for all required environment variables.

### Required for Local Development:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (from `supabase start`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key (from `supabase start`)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key for admin operations (from `supabase start`)

### Future Integrations (Tasks 4+):

- Procore API keys (Task 4+)
- Microsoft Graph credentials (Task 4+)
- Inngest event key (Task 5+)
- LLM provider keys (Task 6+)

## API Endpoints

- `GET /api/health` — Health check endpoint (returns `{ ok: true, supabase: { configured: boolean } }`)
- `POST /auth/callback` — OAuth callback handler for authentication

## Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Testing:** Vitest
- **Linting:** ESLint
- **Package Manager:** pnpm
- **Environment Validation:** Zod
- **Database & Auth:** Supabase (PostgreSQL + Auth)
- **Auth Methods:** Magic link (email OTP), Microsoft (Azure AD, optional)
- **Database:** Supabase (PostgreSQL + Auth)
- **Multi-tenancy:** Row Level Security (RLS)

## Project Structure

```
app/
  (app)/
    app/               # Protected app pages
  api/health/          # Health check endpoint
  auth/callback/       # Auth callback handler
  login/               # Login page
  layout.tsx           # Root layout
  page.tsx             # Homepage
  globals.css          # Global styles
lib/
  auth/                # Auth utilities
  connectors/          # External service connectors
  env.ts               # Environment variable validation
  supabase/            # Supabase client configurations
    client.ts          # Browser client
    server.ts          # Server component client
    admin.ts           # Service role admin client (RLS bypass)
supabase/
  config.toml          # Supabase CLI configuration
  migrations/          # Database migrations
  tests/               # SQL RLS tests
```

## Database Schema

The application uses a multi-tenant architecture with organization-based isolation:

- **orgs** — Organizations (top-level tenant boundary)
- **profiles** — User profiles (extends auth.users)
- **org_memberships** — User memberships with roles (owner/admin/member)
- **projects** — Construction projects (org-scoped)
- **audit_log** — Audit trail for org actions

All tables use Row Level Security (RLS) to enforce tenant isolation. See `supabase/migrations/` for the complete schema.

### Running the Security Tests

**Prerequisites:**
- Docker installed and running (for `test:db`)
- OR PostgreSQL installed locally (for `test:db:nodocker`)

**Full test suite with Docker** (reset DB + pgTAP + RLS integration tests):

```bash
# Start Supabase (if not already running)
pnpm supabase start

# Run complete security test suite
pnpm test:db
```

**Full test suite without Docker** (uses local PostgreSQL):

```bash
# Requires PostgreSQL and pgTAP installed locally
pnpm test:db:nodocker
```

This command:
1. Creates a fresh test database
2. Applies bootstrap script (auth schema, roles, grants)
3. Applies all migrations
4. Runs pgTAP test suite (28 test cases)

**Individual test commands:**

```bash
# pgTAP tests only (requires Supabase running)
pnpm supabase test db

# RLS integration tests only (requires Supabase running)
pnpm test lib/supabase/__tests__/rls.test.ts

# Unit tests (RLS tests skipped without Supabase)
pnpm test
```

**Note**: This repository is hosted on Cursor Origin. GitHub Actions workflows are defined for future GitHub mirroring but do not run on Origin. Run security tests locally before pushing.

## CI

GitHub Actions workflow runs on push and PR:
- Type checking
- Linting  
- Unit tests (RLS tests skip without Supabase)
- Build
- RLS tests (separate job with local Supabase + pgTAP)

**Note**: GitHub Actions do not run on Origin-hosted repositories. The workflow is present for future GitHub mirroring. Run `pnpm test:db` locally to verify security tests.

## What's Next

- Task 4: Inngest event handling
- Task 5: Procore integration
- Task 6+: LLM features
