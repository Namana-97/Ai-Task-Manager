# AI Architecture

```text
User -> Angular Chat Panel -> /chat/ask
     -> Guardrails (sanitise + rate limit + canary)
     -> EmbeddingClient
     -> VectorStoreClient (RBAC-scoped retrieval)
     -> Re-ranker (cosine + keyword overlap)
     -> PromptLoader (versioned prompt template)
     -> LlmClient
     -> Output canary validation + audit log
     -> Answer + source references
```

Embedding generation is driven from the `TaskRepositoryStub` during standalone startup when `SEED_VECTOR_STORE=true`. Tasks are serialized through `buildTaskDocument()`, embedded in batches, and indexed with metadata that supports both retrieval and source attribution. The implementation keeps the task shape behind the exported `TaskDocument` contract so the base system only needs to satisfy that interface.

Prompt templates are stored under `prompts/vN/` and loaded at runtime by `PromptLoader`. This keeps prompts diffable, reviewable, and deploy-auditable. The loader caches files in memory and logs the discovered versions at startup.

# Vector Store Schema

`task_vectors` stores:

- `id`: task identifier
- `org_id`: retrieval scope boundary
- `assignee_id`: viewer-level restriction
- `role`: source role metadata
- `vector`: `vector(1536)` embedding column
- `metadata`: JSONB for task title, category, status, rendered document, org name, and display fields

The HNSW index uses `vector_cosine_ops` with `m = 16` and `ef_construction = 64`. Cosine similarity is the right default here because the embedding providers produce normalized semantic vectors and the query intent is directional similarity rather than magnitude-sensitive distance.

# RBAC In The AI Layer

Retrieval is scoped before any semantic ranking occurs.

- `viewer`: `org_id = orgId AND assignee_id = userId`
- `admin`: `org_id = orgId`
- `owner`: `org_id IN (childOrgIds)`

This filtering is enforced in `VectorStoreClient.search()` and never delegated to the LLM. Mutation flows follow the same principle: intent parsing is separate from execution, parameters are schema-validated, and the executor receives the resolved user scope before any action is run.

# Prompt Engineering

Prompts live in `prompts/v1/`:

- `rag-system.txt`: constrains the assistant to retrieved task records only, requires task ID citations, and embeds the canary token.
- `intent-classifier.txt`: forces tool usage only for mutations or explicit reporting requests.
- `standup-report.txt`: enforces a tight markdown structure for daily reports.
- `anomaly-insights.txt`: keeps anomaly narration short, numeric, and actionable.
- `smart-categorization.txt`: included for the future categorization module so the prompt surface is already versioned.

Versioning strategy:

- Prompts are immutable per version directory.
- New prompt behavior lands in a new `vN` folder.
- The runtime default is the highest discovered version unless a version is explicitly requested.
- Startup logs show which versions are available.

# AI Trade-offs & Limitations

Hallucination risks still exist whenever retrieved context is sparse or stale. The mitigation stack here is layered: strict retrieval scoping, an instruction prompt that forbids speculation, source references in the response payload, a hybrid re-ranker to improve relevance, and canary-token output validation for prompt leakage.

Typical latency targets for the intended production shape:

- Embedding: ~50ms per query
- Vector search: ~10ms
- LLM generation: ~800ms
- End-to-end chat: ~900ms to ~1200ms

Cost estimation example:

- 1000 chat queries/day
- 2000 tokens/query average
- 2,000,000 tokens/day
- At roughly `$0.003 / 1K` input and `$0.015 / 1K` output for `claude-sonnet-4-20250514`, a balanced 75/25 input/output split is about `$9/day`, or roughly `$270/month`

The local embedding provider is intentionally deterministic for offline/dev workflows so the standalone submission can run without remote credentials. In a production integration, the seam is already isolated behind `EmbeddingClient`, so swapping in a real ONNX runtime or managed embedding provider does not affect the rest of the system.
