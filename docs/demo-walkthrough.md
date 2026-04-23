# Demo Walkthrough

## Recording Checklist

1. Start the API with local stubs enabled: `npm run start:api`
2. Start the shell app in a second terminal using your usual Angular workflow.
3. Keep `apps/shell/src/app/mock-chat.interceptor.ts` enabled for deterministic mocked streaming during the recording.
4. If you want vector seeding in the API demo, set `SEED_VECTOR_STORE=true` before launch.
5. Open the shell app and clear the browser state so the chat starts empty.

## Suggested Flow

1. Ask a retrieval question such as `What is blocked right now?`
2. Ask a follow-up question such as `Which Platform tasks are still in progress?`
3. Show a task mutation request such as `Create a High priority analytics task to benchmark retrieval latency`
4. Mention that task mutations now trigger automatic re-indexing.
5. Mention that rate limits now return `429` with `Retry-After`.
6. Show the benchmark commands in the terminal:
   `npm run bench:retrieval`
   `npm run bench:embedding`

## Recording Script

Use this narration-friendly sequence if you want a single clean take:

1. `I can query the task set through the chat panel and get source-linked answers.`
2. `The mocked shell stream stays deterministic, so the response arrives chunk-by-chunk for the demo.`
3. `When a task is created, updated, or deleted through the intent flow, the embedding index is updated immediately.`
4. `Categorization feedback is logged as accepted, edited, or rejected, which gives us a basic acceptance-rate metric.`
5. `If the chat model rate limit is exceeded, the API now responds with 429 and a Retry-After header instead of a 500.`
6. `The repository also includes local benchmark scripts for retrieval latency and embedding throughput.`
