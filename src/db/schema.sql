CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for text search

-- ============================================
-- USER MANAGEMENT & AUTH
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- user, admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- DOCUMENT MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING gin(metadata);

-- ============================================
-- RAG: CHUNKS & EMBEDDINGS
-- ============================================

CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL, -- 768 for Ollama nomic-embed-text, 1536 for OpenAI text-embedding-3-small
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector similarity index (HNSW for production scale)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Text search index for hybrid search
CREATE INDEX IF NOT EXISTS idx_chunks_content_trgm ON chunks USING gin(content gin_trgm_ops);

-- ============================================
-- QUERY & RESPONSE LOGGING
-- ============================================

CREATE TABLE IF NOT EXISTS queries (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  question TEXT NOT NULL,
  intent TEXT, -- classified intent
  contexts_used INT,
  model_name TEXT NOT NULL,
  answer TEXT NOT NULL,
  
  -- Performance metrics
  latency_ms INT,
  tokens_prompt INT,
  tokens_completion INT,
  cost_usd NUMERIC(10,8),
  
  -- Quality tracking
  user_feedback SMALLINT, -- -1, 0, 1 (thumbs down, neutral, thumbs up)
  eval_score NUMERIC(3,2), -- automated evaluation score 0-1
  
  -- Observability
  trace_id TEXT, -- Langfuse trace ID
  error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_trace_id ON queries(trace_id);

-- ============================================
-- COST TRACKING & ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS cost_summary (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_queries INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_summary_user_period 
  ON cost_summary(user_id, period_start, period_end);

-- ============================================
-- EVALUATION FRAMEWORK
-- ============================================

CREATE TABLE IF NOT EXISTS eval_datasets (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_cases (
  id SERIAL PRIMARY KEY,
  dataset_id INT REFERENCES eval_datasets(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  expected_answer TEXT,
  expected_contexts TEXT[], -- expected document chunks
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id SERIAL PRIMARY KEY,
  dataset_id INT REFERENCES eval_datasets(id) ON DELETE CASCADE,
  config JSONB NOT NULL, -- model, k, temperature, etc.
  avg_score NUMERIC(3,2),
  total_cases INT,
  passed_cases INT,
  total_cost_usd NUMERIC(10,4),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS eval_results (
  id SERIAL PRIMARY KEY,
  run_id INT REFERENCES eval_runs(id) ON DELETE CASCADE,
  case_id INT REFERENCES eval_cases(id) ON DELETE CASCADE,
  actual_answer TEXT NOT NULL,
  score NUMERIC(3,2) NOT NULL,
  metrics JSONB DEFAULT '{}', -- detailed metrics (BLEU, ROUGE, etc.)
  latency_ms INT,
  cost_usd NUMERIC(10,8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CACHING
-- ============================================

CREATE TABLE IF NOT EXISTS embedding_cache (
  id SERIAL PRIMARY KEY,
  text_hash TEXT UNIQUE NOT NULL,
  embedding vector(768) NOT NULL, -- 768 for Ollama nomic-embed-text, 1536 for OpenAI text-embedding-3-small
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_accessed ON embedding_cache(accessed_at DESC);
