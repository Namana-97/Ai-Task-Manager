# AI Task Manager

RAG-based task management system with an AI chat interface for querying and managing tasks using natural language.

---

## Features

- Chat with your tasks using natural language  
- Retrieves relevant tasks using embeddings (RAG)  
- Shows answers with task references (sources)  
- Supports follow-up questions  
- Create and update tasks via chat (intent detection)  
- Auto-suggests category and priority for tasks  

---

## Tech Stack

- Frontend: Angular  
- Backend: Node.js / NestJS  
- AI: OpenAI / Claude (LLM)  
- Embeddings: OpenAI Embeddings  
- Vector DB: pgvector / Chroma  
- Authentication: JWT  

---

## How It Works

When a user asks a question, the system converts it into an embedding and retrieves the most relevant tasks from the database. These tasks are passed to the LLM along with the user’s query. The model generates an answer using only this context and returns it with references to the original tasks.

---

## Architecture

- Frontend → sends message  
- Backend → processes request  
- Embedding → finds similar tasks  
- LLM → generates response  
- Response → sent back to UI  

---

## How to Run the Project

```bash
# clone repo
git clone 

# install dependencies
npm install

# run backend
npm run start

# run frontend
npm start

