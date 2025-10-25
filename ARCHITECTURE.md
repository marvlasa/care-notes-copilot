# Architecture Documentation

## System Overview

CareNotes Copilot is a production-grade RAG (Retrieval-Augmented Generation) system for clinical documentation. It combines vector search, keyword matching, LLM generation, and comprehensive observability.

## Design Principles

1. **AI-First**: Built with modern LLM tooling (Cursor, OpenAI, Langfuse)
2. **Production-Ready**: Authentication, rate limiting, caching, monitoring
3. **Cost-Conscious**: Track and optimize every API call
4. **Observable**: Deep insights into performance, quality, and errors
5. **Scalable**: Horizontal scaling with Kubernetes/ECS
6. **Healthcare-Safe**: HIPAA considerations, audit trails, secure by default

## Technical Stack

### Frontend
- **Next.js 16** (App Router)
- **React 19** with Server Components
- **TypeScript 5** for type safety
- **Streaming UI** for progressive responses

### Backend
- **Next.js API Routes** (serverless-ready)
- **PostgreSQL 16** with pgvector extension
- **Redis 7** for caching and rate limiting
- **Node.js 20+** runtime

### AI/ML
- **OpenAI GPT-4o-mini** for generation
- **text-embedding-3-small** for embeddings (1536 dimensions)
- **Hybrid search**: Vector + keyword (trigram)
- **LLM-based reranking** for context quality

### Infrastructure
- **Docker Compose** for local development
- **Kubernetes** for production orchestration
- **Pulumi** (TypeScript) for IaC
- **AWS ECS Fargate** / GKE for compute
- **RDS PostgreSQL** / CloudSQL for database
- **ElastiCache** / Memorystore for Redis

## Data Flow

### Query Processing Pipeline

```
1. Request
   ↓
2. [Middleware] Authentication → Rate Limiting → Logging
   ↓
3. [Intent] Classify query intent (medical/search/analysis/admin)
   ↓
4. [Retrieval] Hybrid search
   ├─ Vector search (pgvector HNSW index)
   ├─ Keyword search (PostgreSQL trigrams)
   └─ Merge & deduplicate
   ↓
5. [Reranking] LLM scores relevance (top K from 2K)
   ↓
6. [Cache] Check Redis for similar query
   ↓
7. [Generation] Stream LLM response
   ├─ Build context from top-K chunks
   ├─ Construct prompt with safety guidelines
   └─ Stream tokens to client
   ↓
8. [Logging] Record query, cost, latency, trace
   ↓
9. [Response] Return streamed answer + metadata
```

### Embedding Pipeline

```
1. Document ingestion
   ↓
2. Chunking (800 chars, overlap optional)
   ↓
3. Generate embeddings (batched)
   ├─ Check cache (Redis + DB)
   └─ Call OpenAI API
   ↓
4. Store in PostgreSQL
   ├─ chunks table (content + embedding)
   └─ HNSW index for fast retrieval
```

## Database Schema

### Core Tables

- **users**: Authentication and RBAC
- **api_keys**: API key management
- **documents**: Source documents (title, source, metadata)
- **chunks**: Text chunks with vector embeddings
- **queries**: Request/response logs with metrics
- **cost_summary**: Monthly cost aggregation per user

### Evaluation Tables

- **eval_datasets**: Test case collections
- **eval_cases**: Individual test cases (question, expected answer)
- **eval_runs**: Evaluation execution records
- **eval_results**: Per-case scores and metrics

### Indexes

```sql
-- Vector similarity (HNSW for production scale)
CREATE INDEX idx_chunks_embedding ON chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Keyword search (trigram for fuzzy matching)
CREATE INDEX idx_chunks_content_trgm ON chunks 
  USING gin(content gin_trgm_ops);

-- Query lookups
CREATE INDEX idx_queries_user_id ON queries(user_id);
CREATE INDEX idx_queries_created_at ON queries(created_at DESC);
CREATE INDEX idx_queries_trace_id ON queries(trace_id);
```

## Retrieval Strategy

### Hybrid Search

Combines two complementary approaches:

1. **Vector Search** (semantic similarity)
   - Embedding-based cosine similarity
   - Captures meaning and context
   - Good for paraphrased or conceptual queries

2. **Keyword Search** (lexical matching)
   - PostgreSQL `similarity()` with trigrams
   - Exact term matching
   - Good for medical terminology, codes, names

**Fusion**: Weighted combination (70% vector, 30% keyword)

### Reranking

After retrieving 2K candidates, rerank to K using:
- LLM-based scoring (GPT-4o-mini)
- Returns relevance scores 0-10
- Combines with original similarity for final ranking

Benefits:
- Higher precision (removes false positives)
- Context-aware (understands query nuance)
- Cost-effective (only for top candidates)

## Cost Management

### Tracking

Every API call is tracked:
```typescript
{
  model: "gpt-4o-mini",
  inputTokens: 1200,
  outputTokens: 350,
  costUsd: 0.00039  // $0.15/M input + $0.60/M output
}
```

### Optimization Strategies

1. **Caching**
   - Embeddings cached 7 days (Redis + DB)
   - Retrieval results cached 1 hour
   - ~70% cache hit rate expected

2. **Model Selection**
   - Use `gpt-4o-mini` instead of `gpt-4o` (10x cheaper)
   - Use `text-embedding-3-small` (1536d) vs 3-large (3072d)

3. **Prompt Engineering**
   - Concise system prompts
   - Limit context window (top-4 chunks)
   - Max tokens: 1000 for answers

4. **Batch Operations**
   - Batch embeddings during seeding
   - Async evaluation runs

5. **Alerts**
   - Email/Slack when user exceeds threshold
   - Daily cost reports
   - Anomaly detection

## Observability

### Langfuse Integration

Traces every request with:
- **Input**: user query, model, k
- **Output**: answer (truncated), contexts retrieved
- **Metadata**: intent, cost, latency, IP, user agent
- **Status**: success/error with error message

View traces at [cloud.langfuse.com](https://cloud.langfuse.com)

### Sentry Error Tracking

Captures:
- Runtime exceptions
- API errors (OpenAI, PostgreSQL, Redis)
- Performance issues (slow queries)
- User-facing errors

### Custom Metrics

```typescript
// Prometheus-style metrics (future)
{
  "query_latency_ms_p95": 850,
  "retrieval_quality_score": 0.82,
  "cache_hit_rate": 0.71,
  "cost_per_query_usd": 0.00042,
  "intent_classification_accuracy": 0.94
}
```

## Security

### Authentication

Two modes:
1. **JWT Tokens**: For web clients (7-day expiry)
2. **API Keys**: For programmatic access (`ApiKey ck_...`)

Both verified per-request with bcrypt/SHA-256 hashing.

### Rate Limiting

Redis-backed sliding window:
- Default: 100 requests / 15 minutes
- Per user (authenticated) or IP (anonymous)
- Returns `429` with `Retry-After` header

### Data Protection

1. **Secrets Management**
   - AWS Secrets Manager (ECS)
   - Kubernetes Secrets (K8s)
   - Never commit secrets to git

2. **Network Security**
   - TLS everywhere (ALB, ingress)
   - Private subnets for DB/Redis
   - Security groups restrict access

3. **Audit Logging**
   - All queries logged with user, IP, timestamp
   - Immutable append-only log
   - Trace IDs for correlation

## Evaluation Framework

### Test Cases

Defined in `eval_cases` table:
```typescript
{
  question: "What medication is prescribed for hypertension?",
  expectedAnswer: "Lisinopril 20mg daily",
  expectedContexts: ["hypertension"]
}
```

### Scoring

1. **Semantic Similarity** (70% weight)
   - Embed expected vs actual answer
   - Cosine similarity

2. **Keyword Matching** (30% weight)
   - Extract keywords from expected answer
   - Check presence in actual answer

3. **Combined Score**
   - Weighted average
   - Pass threshold: 0.70

### Metrics

- **Accuracy**: % of cases with score ≥ 0.70
- **Avg Score**: Mean across all cases
- **Latency**: p50, p95, p99
- **Cost**: Total USD for eval run

Run with:
```bash
npm run eval:run -- clinical-qa-v1 gpt-4o-mini 4
```

## Scaling Strategy

### Horizontal Scaling

**Application Tier**:
- Stateless Next.js instances
- Auto-scale on CPU (70%) or requests/second
- Min: 3, Max: 20 pods/tasks

**Database Tier**:
- Read replicas for retrieval queries
- Primary for writes (queries log)
- Connection pooling (pgBouncer)

**Cache Tier**:
- Redis Cluster for high availability
- Eviction policy: LRU
- Separate cache for embeddings vs retrieval

### Vertical Scaling

- **DB**: Start with db.t4g.micro, scale to r6g.xlarge
- **App**: 512 MB → 2 GB memory based on load
- **Redis**: cache.t4g.micro → cache.r6g.large

### Caching Strategy

```
┌─────────────┐
│   Browser   │  (no caching, real-time)
└──────┬──────┘
       │
┌──────▼──────┐
│  Redis L1   │  Embeddings (7d), Retrieval (1h)
└──────┬──────┘
       │
┌──────▼──────┐
│ PostgreSQL  │  Persistent embedding_cache table
│   L2        │  (accessed_at, access_count)
└─────────────┘
```

## Deployment

### Local (Docker Compose)

```bash
npm run setup  # Start DB, Redis, seed data
npm run dev    # Start Next.js
```

### Staging (Kubernetes)

```bash
kubectl apply -f k8s/deployment.yaml
kubectl -n carenotes get pods
```

### Production (AWS ECS via Pulumi)

```bash
cd infra
pulumi config set prod
pulumi up
```

Provisions:
- VPC with public/private subnets
- RDS PostgreSQL Multi-AZ
- ElastiCache Redis
- ECS Fargate cluster (auto-scaling)
- Application Load Balancer (HTTPS)
- CloudWatch logs & alarms

## Future Enhancements

### Short-term
- [ ] GraphQL API alongside REST
- [ ] Feedback loop (thumbs up/down)
- [ ] A/B testing framework (model comparison)
- [ ] Cohere/Jina reranking models

### Medium-term
- [ ] Multi-tenancy (org-level isolation)
- [ ] Fine-tuned embeddings (healthcare domain)
- [ ] Streaming retrieval (progressive context)
- [ ] Conversation history / multi-turn dialogs

### Long-term
- [ ] On-premise deployment (airgapped)
- [ ] Local LLMs (Llama 3, Mixtral)
- [ ] FHIR integration
- [ ] Voice interface (Whisper + TTS)

## Performance Benchmarks

Target SLAs:
- **Latency**: p95 < 2s, p99 < 5s
- **Availability**: 99.9% uptime
- **Error Rate**: < 0.1%
- **Cache Hit**: > 60%

Load test results (local):
```
Requests:     1,250
Throughput:   125 req/sec
Latency p95:  850ms
Latency p99:  1,200ms
Errors:       0
```

## Contact & Support

- **Issues**: GitHub Issues
- **Docs**: [README.md](./README.md)
- **Email**: support@carenotes.example.com

---

**Last Updated**: 2025-10-24

