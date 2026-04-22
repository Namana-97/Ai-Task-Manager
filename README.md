# Ai-Task-Manager
RAG-based task management system with an AI chat interface for querying and managing tasks using natural language.

# Features
i. Chat with your tasks using natural language
ii. Retrieves relevant tasks using embeddings (RAG)
iii.Shows answers with task references (sources)
iv.Supports follow-up questions
v.Create/update tasks via chat (intent detection)
vi.Auto-suggest category and priority for tasks

# Tech Stack
Frontend: Angular
Backend: Node.js / NestJS
AI: OpenAI / Claude (LLM)
Embeddings: OpenAI embeddings
Vector DB: pgvector / Chroma
Auth: JWT

# Working 
When a user asks a question, the system converts it into an embedding and retrieves the most relevant tasks from the database. These tasks are passed to the LLM along with the user’s query. The model then generates an answer using only this context and returns it with references to the original tasks.

# Architecture
Frontend → sends message
Backend → processes request
Embedding → finds similar tasks
LLM → generates response
Response → sent back to UI

# How to run the project
  # clone repo
  git clone ...

  # install dependencies
  npm install

  # run backend
  npm run start

  # run frontend
  npm start

# Example
User: "What did I complete this week?"
Assistant: "You completed 3 tasks..."

# Limitation
Responses depend on retrieved data quality
May struggle with vague queries
Requires API keys for LLM
