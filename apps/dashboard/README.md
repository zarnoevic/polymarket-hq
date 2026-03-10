# Polymarket HQ

Private Next.js dashboard for Polymarket market analysis and insights. Uses its own PostgreSQL database.

## Local development

```bash
# From repo root
pnpm dev
```

Runs at http://localhost:3213

## Database

Uses `@polymarket-hq/dashboard-prisma` with `DATABASE_URL`. Migrations:

```bash
# Create migration
pnpm db:migrate

# Deploy (production)
pnpm db:migrate:deploy
```

## Render

The `render.yaml` defines a **Polymarket-HQ** project with:
- **dashboard** — web service (Next.js)
- **polymarket-hq-pg** — PostgreSQL database

Connect your repo to Render and apply the blueprint. The dashboard service will run migrations on deploy.
