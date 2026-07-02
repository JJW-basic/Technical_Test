# Initial Project Environment Setup Plan

This plan establishes the foundation for the local development environment using Docker Compose. The environment decouples Frontend, Backend, Worker, Redis, and Nginx proxy to facilitate clean visual design, API development, and task worker integrations.

## User Review Required

> [!IMPORTANT]
> The setup utilizes a Docker Compose environment. Please ensure that Docker Desktop is installed and running on your local Windows system.
> The initial build and dependency install commands will download base packages for Python (uv-based) and Node (Vite + TypeScript).

## Proposed Changes

We will create a multi-container directory layout:
- `frontend/`: React SPA with Vite, TypeScript, and TailwindCSS.
- `backend/`: FastAPI application using `uv` for dependency management.
- `nginx/`: Nginx reverse proxy configuration mapping `/` to frontend and `/api/*` to backend.
- Root: `docker-compose.yml` orchestrating all containers.

---

### Root Environment Orchestration

#### [NEW] [docker-compose.yml](file:///d:/08_Technical_Test/docker-compose.yml)
Define services:
- `frontend`: React SPA, binds port 3000 (proxied by Nginx).
- `backend`: FastAPI app running on port 8000 (proxied by Nginx).
- `worker`: Taskiq worker utilizing the same FastAPI package context.
- `redis`: Task queue/broker.
- `nginx`: Single entry point on port 80 proxying requests to frontend and backend.

---

### Frontend Component

#### [NEW] [frontend/package.json](file:///d:/08_Technical_Test/frontend/package.json)
Standard React + TypeScript + TailwindCSS + Vite setup.

#### [NEW] [frontend/vite.config.ts](file:///d:/08_Technical_Test/frontend/vite.config.ts)
Vite configuration for React + TypeScript.

#### [NEW] [frontend/tailwind.config.js](file:///d:/08_Technical_Test/frontend/tailwind.config.js)
TailwindCSS setup.

#### [NEW] [frontend/index.html](file:///d:/08_Technical_Test/frontend/index.html)
Main HTML page template.

#### [NEW] [frontend/src/main.tsx](file:///d:/08_Technical_Test/frontend/src/main.tsx)
Frontend entry point.

#### [NEW] [frontend/src/App.tsx](file:///d:/08_Technical_Test/frontend/src/App.tsx)
Core SPA layout containing user input for URL and keyword, stylized professionally.

#### [NEW] [frontend/Dockerfile](file:///d:/08_Technical_Test/frontend/Dockerfile)
Development Dockerfile utilizing volume binding.

---

### Backend & Worker Component

#### [NEW] [backend/pyproject.toml](file:///d:/08_Technical_Test/backend/pyproject.toml)
FastAPI, Taskiq, Redis, HTTPX, BeautifulSoup4, and Playwright dependencies managed via uv.

#### [NEW] [backend/app/main.py](file:///d:/08_Technical_Test/backend/app/main.py)
FastAPI web application exposing initial check and information retrieval API paths under `/api`.

#### [NEW] [backend/app/tasks.py](file:///d:/08_Technical_Test/backend/app/tasks.py)
Taskiq and task orchestration setup.

#### [NEW] [backend/Dockerfile](file:///d:/08_Technical_Test/backend/Dockerfile)
Multi-stage Dockerfile optimized with uv package manager caching.

---

### Nginx Component

#### [NEW] [nginx/nginx.conf](file:///d:/08_Technical_Test/nginx/nginx.conf)
Routing instructions mapping root `/` requests to `frontend` container and `/api/` to backend.

#### [NEW] [nginx/Dockerfile](file:///d:/08_Technical_Test/nginx/Dockerfile)
Lightweight Nginx service Dockerfile.

---

## Verification Plan

### Automated Tests
- Verification of configuration syntax.

### Manual Verification
- Execute `docker compose up --build` to boot up all containers.
- Access `http://localhost/` (Nginx entry) to view the Frontend UI and ensure API routes function.
