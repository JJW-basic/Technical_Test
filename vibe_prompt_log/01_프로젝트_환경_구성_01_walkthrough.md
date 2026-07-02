# Walkthrough: Initial Project Environment Setup

This project is now configured for clean, multi-container development.

## Project Structure Overview

```
d:\08_Technical_Test/
├── docker-compose.yml       # Orchestrates the containers
├── frontend/                # React SPA, Vite, TypeScript, TailwindCSS
│   ├── src/
│   │   ├── App.tsx          # Main View component
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
├── backend/                 # FastAPI, Taskiq, Redis
│   ├── app/
│   │   ├── main.py          # FastAPI application server
│   │   └── tasks.py         # Taskiq Broker and Task setup
│   ├── pyproject.toml       # uv Package configurations
│   └── Dockerfile
└── nginx/                   # Reverse Proxy Routing Endpoint
    ├── nginx.conf
    └── Dockerfile
```

---

## Components Configuration Details

### 1. Reverse Proxy (Nginx)
The [nginx.conf](file:///d:/08_Technical_Test/nginx/nginx.conf) maps single port entry point:
- `/api/*` -> Forward to FastAPI backend (`backend:8000`)
- `/` -> Forward to Vite dev server (`frontend:3000`) with WebSocket protocol upgrade for Hot Module Reloading (HMR).

### 2. Frontend (React SPA)
Custom styled with premium glassmorphic cards and blue gradient glow.
- Handles user inputs for Target URL and Comma-separated Keywords.
- Submits structured JSON payloads to `/api/scrape` endpoint.

### 3. Backend (FastAPI + Taskiq Worker)
Setup uses Python uv dependencies.
- Task broker is defined using Redis queue.
- Pre-configured base endpoints structure for crawler agent logic deployment.

---

## Instructions to Run Local Environment

Execute the following command in your terminal inside the workspace directory:

```bash
docker compose up --build
```

- Access Frontend UI: `http://localhost/`
- Health check API: `http://localhost/api/health`
