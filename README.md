# Auditly

Continuous dependency security auditing for your GitHub repositories. Sign in with GitHub, scan your repos for vulnerable packages, and get CVE-level details — all in one dashboard.

## What it does

- **GitHub OAuth sign-in** — uses your own access token, no static credentials needed
- **Automatic repo discovery** — lists every repo you own or collaborate on
- **Dependency scanning** — reads `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, and other manifests
- **CVE lookup** — checks each package version against the [OSV.dev](https://osv.dev) database
- **Real-time progress** — scan streams live via SSE, rows populate as each repo completes
- **Persistence detection** — flags files that survive uninstall (e.g. husky hooks, postinstall scripts)
- **Severity breakdown** — Critical / High / Medium / Low badges per repo and per package

## Tech stack

- [Next.js 16](https://nextjs.org) App Router, React 19, TypeScript
- [NextAuth v5](https://authjs.dev) — GitHub OAuth provider, JWT stores access token
- [GitHub REST API v3](https://docs.github.com/en/rest) — repo listing and file tree traversal
- [OSV.dev batch API](https://google.github.io/osv.dev/api/) — open-source vulnerability database
- [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS v4
- [Three.js](https://threejs.org) + [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) + [three-globe](https://github.com/vasturiano/three-globe) — interactive 3D globe on the sign-in page

## Getting started

### 1. Create a GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**:

| Field | Value |
|---|---|
| Application name | Auditly (local) |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

Copy the **Client ID** and generate a **Client Secret**.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
AUTH_SECRET=<random 32-char string — run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000

GITHUB_CLIENT_ID=<from OAuth App>
GITHUB_CLIENT_SECRET=<from OAuth App>
```

### 3. Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, and run your first audit.

## Project structure

```
app/
  page.tsx              # Dashboard
  signin/page.tsx       # Sign-in page with interactive globe
  api/
    repos/route.ts      # Lists GitHub repos for the authenticated user
    scan/route.ts        # SSE endpoint that streams scan progress
lib/
  github.ts             # GitHub REST API wrapper
  scanner.ts            # Repo scanning logic (manifest parsing + OSV lookup)
  osv.ts                # OSV.dev batch CVE lookup
  types.ts              # Shared TypeScript types
components/
  dashboard/            # Scan controls, repo table, drawer, summary cards
  layout/               # Navbar, persistence banner
  ui/                   # shadcn/ui primitives + globe
```

## Deployment

Set the same env vars on your host. For Vercel:

```bash
vercel env add AUTH_SECRET
vercel env add AUTH_URL          # your production URL
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET
```

Update the GitHub OAuth App's callback URL to match your production domain.
