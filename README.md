# CareNotes Copilot

> Production-ready AI-powered clinical documentation assistant built with RAG, LLMs, and modern observability.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
[![pgvector](https://img.shields.io/badge/pgvector-latest-blue)](https://github.com/pgvector/pgvector)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## 🚀 Features

### AI & RAG
- **Hybrid Retrieval**: Combines vector similarity (pgvector) + keyword search (PostgreSQL trigrams)
- **LLM-based Reranking**: Improves context relevance using GPT-4o-mini
- **Intent Classification**: Automatically categorizes queries (medical, search, analysis, admin)
- **Query Expansion**: Generates semantic variations for better recall
- **Streaming Responses**: Real-time answer generation with progressive loading

### Production-Ready Infrastructure
- **Authentication**: JWT tokens + API keys with secure hashing
- **Rate Limiting**: Redis-backed per-user/IP rate limits
- **Caching**: Multi-layer caching (Redis + PostgreSQL) for embeddings and responses
- **Cost Tracking**: Real-time cost monitoring with alerts
- **Observability**: Langfuse tracing, Sentry error tracking, structured logging

### Evaluation & Quality
- **Evaluation Framework**: Automated test suite with semantic similarity + keyword matching
- **Load Testing**: Autocannon-based performance benchmarking
- **Metrics Dashboard**: Track accuracy, latency, cost per query

### DevOps & Deployment
- **Docker Compose**: Local development environment
- **Kubernetes**: Production-ready manifests with HPA, PDB, ingress
- **Pulumi IaC**: AWS infrastructure (ECS Fargate, RDS, ElastiCache, ALB)
- **CI/CD Ready**: Prepared for GitHub Actions / GitLab CI

## 📋 Prerequisites

- **Node.js** 20+ (uses ESM modules)
- **Docker** & Docker Compose
- **PostgreSQL** 16+ with `pgvector` extension
- **Redis** 7+
- **OpenAI API Key**

## 🏃 Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd care-notes-copilot
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your keys
```

Required variables:
```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carenotes
REDIS_URL=redis://localhost:6379
JWT_SECRET=<min-32-char-secret>
```

### 3. Start Infrastructure & Seed Data

```bash
npm run setup
```

This command:
- Starts Docker Compose (PostgreSQL + Redis)
- Initializes database schema
- Seeds clinical notes
- Creates evaluation dataset

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🧪 Testing & Evaluation

### Unit & Integration Tests

```bash
npm test
```

### Evaluation Suite

```bash
# Run evaluation on test dataset
npm run eval:run

# Custom configuration
npm run eval:run -- clinical-qa-v1 gpt-4o-mini 4
```

### Load Testing

```bash
npm run test:load

# Custom duration/connections
npm run test:load -- --duration 30 --connections 10
```

## 📊 Architecture

```
┌─────────────┐
│  Next.js UI │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│              API Routes (/api/ask)              │
│  • Auth Middleware                              │
│  • Rate Limiting                                │
│  • Intent Classification                        │
└──────┬──────────────────────────────────────────┘
       │
       ├──────────────┬──────────────┬─────────────┐
       ▼              ▼              ▼             ▼
┌──────────┐   ┌──────────┐   ┌──────────┐  ┌─────────┐
│ Retrieval│   │ OpenAI   │   │ Langfuse │  │  Redis  │
│ (Hybrid) │   │   LLM    │   │  Traces  │  │  Cache  │
└─────┬────┘   └──────────┘   └──────────┘  └─────────┘
      │
      ▼
┌────────────────────────────────┐
│  PostgreSQL + pgvector         │
│  • Documents & Chunks          │
│  • HNSW Index                  │
│  • Full-text Search (trigrams) │
│  • Cost Tracking               │
│  • Evaluation Results          │
└────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design docs.

## 📁 Project Structure

```
care-notes-copilot/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   │   └── ask/      # Main RAG endpoint
│   │   └── page.tsx      # UI
│   ├── ai/               # AI/ML logic
│   │   ├── openai.ts     # OpenAI client
│   │   ├── retrieval.ts  # Hybrid search + reranking
│   │   └── intent.ts     # Intent classification
│   ├── lib/              # Shared utilities
│   │   ├── auth.ts       # JWT + API keys
│   │   ├── rate-limit.ts # Rate limiting
│   │   ├── redis.ts      # Cache client
│   │   └── cost-tracking.ts
│   ├── config/
│   │   └── env.ts        # Environment validation
│   ├── db/
│   │   ├── index.ts      # PostgreSQL client
│   │   └── schema.sql    # Database schema
│   └── obs/
│       └── langfuse.ts   # Observability
├── scripts/
│   ├── init-db.ts        # Initialize schema
│   ├── seed.ts           # Seed documents
│   ├── seed-eval.ts      # Seed evaluation cases
│   ├── run-eval.ts       # Run evaluation
│   └── load-test.ts      # Performance testing
├── infra/
│   └── index.ts          # Pulumi IaC (AWS)
├── k8s/
│   └── deployment.yaml   # Kubernetes manifests
├── data/
│   └── notes/            # Sample clinical notes
├── docker-compose.yml
└── package.json
```

## 🔐 Security & Compliance

### HIPAA Considerations

**⚠️ This is a demonstration project. For HIPAA compliance:**

1. **Data Encryption**
   - Enable at-rest encryption for PostgreSQL and Redis
   - Use TLS for all network communication
   - Encrypt secrets in AWS Secrets Manager / K8s Secrets

2. **Access Control**
   - Implement role-based access control (RBAC)
   - Audit logs for all data access
   - Multi-factor authentication

3. **Audit Trail**
   - Log all queries, user actions, and system events
   - Retain logs for 6+ years
   - Implement tamper-proof logging

4. **Business Associate Agreement (BAA)**
   - Sign BAAs with OpenAI, cloud providers
   - Use Azure OpenAI for HIPAA-compliant LLMs

5. **PHI Handling**
   - Tokenize/de-identify PHI before sending to LLMs
   - Implement data retention policies
   - Right to erasure (GDPR/HIPAA)

See [SECURITY.md](./SECURITY.md) for full details.

## 📈 Monitoring & Observability

### Langfuse Traces
- Request tracing with input/output logging
- Cost and latency tracking
- Quality scoring

### Sentry Error Tracking
Set `SENTRY_DSN` in `.env.local` to enable

### Custom Metrics
- Cost per user/query
- Retrieval quality (similarity scores)
- Intent classification accuracy
- p95/p99 latency

## 🚢 Deployment

### Docker

```bash
docker build -t carenotes:latest .
docker run -p 3000:3000 --env-file .env.local carenotes:latest
```

### Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
kubectl -n carenotes get pods
```

### AWS (Pulumi)

```bash
cd infra
pulumi config set dbPassword <secure-password> --secret
pulumi config set openaiApiKey <key> --secret
pulumi config set jwtSecret <secret> --secret
pulumi config set certificateArn <acm-arn>
pulumi up
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](./LICENSE)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [OpenAI](https://openai.com/) - LLM APIs
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
- [Langfuse](https://langfuse.com/) - LLM observability
- [Pulumi](https://www.pulumi.com/) - Infrastructure as Code

---

**Built with ❤️ for healthcare professionals**
