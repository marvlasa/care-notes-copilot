# Quick Start Guide

Get CareNotes Copilot running in 5 minutes.

## Prerequisites

- Node.js 20+ 
- Docker & Docker Compose
- OpenAI API key

## Step-by-Step Setup

### 1. Clone & Install

```bash
cd care-notes-copilot
npm install
```

### 2. Configure Environment

Create `.env.local`:

```bash
# OpenAI (REQUIRED)
OPENAI_API_KEY=sk-proj-...

# Database (provided by Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carenotes

# Redis (provided by Docker)
REDIS_URL=redis://localhost:6379

# Auth (generate a secure 32+ char string)
JWT_SECRET=your-secret-key-min-32-characters-long

# Optional: Langfuse (leave empty if you don't have it)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Optional: Sentry
SENTRY_DSN=

# Rate Limiting (defaults provided)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Cost Management
COST_ALERT_THRESHOLD_USD=100
```

### 3. Start Services & Seed Data

```bash
npm run setup
```

This single command:
- ✅ Starts Docker Compose (PostgreSQL + Redis)
- ✅ Waits for services to be healthy
- ✅ Initializes database schema (tables, indexes, extensions)
- ✅ Seeds 3 clinical notes (hypertension, diabetes, asthma)
- ✅ Creates evaluation test dataset

**Expected output:**
```
[+] Running 2/2
 ✔ Container carenotes-db-1     Started
 ✔ Container carenotes-redis-1  Started

DB schema ready.
Seeded hypertension.md
Seeded diabetes.md
Seeded asthma.md
✓ Seeded 10 evaluation cases
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing the API

### Via UI

Navigate to `http://localhost:3000` and type:

```
What medication is prescribed for hypertension?
```

You should see a streaming response mentioning Lisinopril.

### Via curl

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What medication is prescribed for hypertension?",
    "sessionId": "test-session",
    "k": 4
  }'
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T...",
  "checks": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

## Running Tests

### Unit & Integration Tests

```bash
npm test
```

Tests:
- Embedding generation & caching
- Retrieval quality
- Hybrid search
- Cache hit rates

### Evaluation Suite

```bash
npm run eval:run
```

Runs 10 test cases and outputs:
- Average score (target: 0.70)
- Pass rate
- Latency metrics
- Total cost

### Load Testing

```bash
npm run test:load
```

Benchmarks throughput and latency for 10 seconds with 5 concurrent connections.

## Troubleshooting

### "Cannot connect to database"

Check Docker Compose is running:
```bash
docker compose ps
```

Restart if needed:
```bash
docker compose down
docker compose up -d
```

### "OPENAI_API_KEY is required"

Ensure `.env.local` has your OpenAI API key starting with `sk-`.

### "Redis connection failed"

Check Redis is healthy:
```bash
docker compose exec redis redis-cli ping
```

Should return `PONG`.

### "No chunks found in retrieval"

Database not seeded. Run:
```bash
npm run db:seed
```

### "JWT_SECRET must be at least 32 characters"

Generate a secure secret:
```bash
openssl rand -base64 32
```

Add to `.env.local`:
```
JWT_SECRET=<generated-secret>
```

## Next Steps

1. **Add More Notes**: Put `.md` files in `data/notes/` and run `npm run db:seed`
2. **Authentication**: Create users via `scripts/create-user.ts` (TODO)
3. **Monitor**: Enable Langfuse/Sentry for production observability
4. **Deploy**: Use `k8s/deployment.yaml` or `infra/` for cloud deployment

## Project Structure

```
care-notes-copilot/
├── src/
│   ├── app/api/ask/     → Main RAG endpoint
│   ├── ai/              → Retrieval, intent, OpenAI
│   ├── lib/             → Auth, rate limit, cache
│   ├── db/              → PostgreSQL client + schema
│   └── obs/             → Langfuse observability
├── scripts/
│   ├── init-db.ts       → Initialize schema
│   ├── seed.ts          → Seed documents
│   ├── run-eval.ts      → Run evaluation
│   └── load-test.ts     → Performance testing
├── data/notes/          → Clinical notes (Markdown)
├── docker-compose.yml   → Local dev environment
└── package.json         → Scripts + dependencies
```

## Useful Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run start            # Start production server

# Database
npm run db:up            # Start Docker Compose
npm run db:init          # Initialize schema
npm run db:seed          # Seed clinical notes
npm run db:seed:eval     # Seed evaluation dataset

# Testing
npm test                 # Unit tests (Vitest)
npm run eval:run         # Run evaluation suite
npm run test:load        # Load testing

# One-liner setup
npm run setup            # All of the above at once
```

## Support

- **Documentation**: [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Issues**: GitHub Issues
- **Interview Prep**: [INTERVIEW_SHOWCASE.md](./INTERVIEW_SHOWCASE.md)

---

**Ready to build? Start with `npm run setup` then `npm run dev`!** 🚀

