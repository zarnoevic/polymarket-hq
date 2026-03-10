# Polymarket HQ

Private Next.js dashboard for Polymarket market analysis and insights.

- **Next.js 15** · **React 19** · **Prisma** · **PostgreSQL** · **Tailwind**

## Getting started

```bash
pnpm install
pnpm dev
```

Runs at http://localhost:3213

## Database

PostgreSQL via `@polymarket-hq/dashboard-prisma`. Local dev:

```bash
pnpm db:docker:up   # Start Postgres (docker-compose)
pnpm db:migrate    # Run migrations
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dashboard dev server |
| `pnpm build` | Build for production |
| `pnpm gen` | Generate Prisma client |
| `pnpm db:migrate` | Create/apply migrations (dev) |
| `pnpm db:migrate:deploy` | Apply migrations (prod) |
| `pnpm db:docker:up` | Start local Postgres |

## Render

Deploy via `render.yaml` — connects repo, provisions PostgreSQL, runs migrations on deploy.
