# Nova AI

**Enterprise Multi-Modal Knowledge Graph & Graph RAG Compliance Platform**

> Transform enterprise compliance documents into intelligent, citation-backed knowledge.

Built for **Domain 3: Gen AI — Problem Statement 1** (Multi-Modal Knowledge Graph Synthesis for Enterprise Compliance).

---

## 1. Project Overview

Nova AI ingests heterogeneous compliance documents — PDFs, Word docs, spreadsheets, images, and audio
logs — extracts a structured entity-relationship graph, and answers natural-language compliance
questions using **Hybrid Graph RAG**: semantic vector search and knowledge-graph traversal are merged
into a single evidence context before an LLM ever generates a word. Every answer carries inline
citations (document, page, excerpt) and a confidence score. If the evidence doesn't support an answer,
Nova AI says so instead of guessing.

**Core requirements met:**
- Reads heterogeneous regulatory data formats (PDF, DOCX, TXT, CSV, XLSX, images, audio)
- Extracts precise entity-relationship webs from unstructured content
- Constructs a structured, dynamic knowledge graph (NetworkX, Neo4j-ready architecture)
- Uses Graph RAG to answer complex analytical compliance questions with citations + confidence scores

**A note on the AI layer:** Nova AI calls the real Gemini 2.5 Flash API for entity/relationship
extraction and answer generation when `GEMINI_API_KEY` is configured. If no key is set, every stage
automatically falls back to a deterministic local pipeline (regex/heuristic extraction, a hashing-based
embedding space, and extractive answer synthesis) — so the **entire pipeline is demoable end-to-end
with zero external dependencies**, which we verified by running the full upload → graph → ask flow
locally with no API key. Wire up a key to upgrade extraction quality and generation fluency without
changing any other code.

---

## 2. Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│   React 19  │◄────►│   FastAPI (async) │◄────►│  SQLite / Postgres   │
│  Vite + TS  │ REST │                    │      │  (documents, users,  │
│  TailwindCSS│  &   │  Auth (JWT)        │      │   entities, chunks)  │
│  React Flow │  WS  │  Upload pipeline   │      └─────────────────────┘
│  Recharts   │      │  Graph RAG engine  │      ┌─────────────────────┐
└─────────────┘      │  NetworkX graph    │◄────►│  Gemini 2.5 Flash    │
                      └──────────────────┘      │  (or local fallback) │
                                                 └─────────────────────┘
```

**Processing pipeline:** Upload → Extract Text (PyMuPDF/python-docx/openpyxl/OCR) → Clean → Chunk →
Embed → Entity Extraction → Relationship Extraction → Knowledge Graph → Vector Store → Ready

**Graph RAG pipeline:** Question → Knowledge Graph Search + Semantic Search → Merge Context →
Gemini → Cited, confidence-scored Answer

See `backend/` for the modular folder structure (`routers/`, `graph/`, `rag/`, `embeddings/`, `llm/`,
`utils/`, `auth/`) — the graph layer is intentionally decoupled so it can be swapped for a Neo4j-backed
implementation without touching the API or RAG layers.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, Framer Motion, React Router, TanStack Query, Zustand, Axios, React Hook Form + Zod, React Flow, Recharts |
| Backend | Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic, async endpoints, WebSockets |
| AI | Gemini 2.5 Flash (generation), Gemini text-embedding-004 (embeddings) — with local fallback |
| Knowledge Graph | NetworkX (modular, Neo4j-migration-ready) |
| Document Parsing | PyMuPDF (PDF), python-docx (DOCX), OpenPyXL + Pandas (Excel/CSV) |
| Database | SQLite by default (zero-config); Postgres-ready via `DATABASE_URL` |
| Deployment | Docker Compose, Vercel (frontend), Render (backend), Supabase Postgres |

---

## 4. Installation

### Prerequisites
- Python 3.11+
- Node.js 20+
- (Optional) Docker & Docker Compose

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add GEMINI_API_KEY if you have one
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env            # set VITE_API_URL if backend isn't on localhost:8000
npm run dev
```

The app will be live at `http://localhost:5173`, talking to the API at `http://localhost:8000`.
Interactive API docs are auto-generated at `http://localhost:8000/docs`.

### Docker Compose (both services)
```bash
GEMINI_API_KEY=your-key-here docker compose up --build
```

---

## 5. Environment Variables

**backend/.env**
| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Secret for signing auth tokens | dev value — **change in production** |
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./storage/nova.db` |
| `GEMINI_API_KEY` | Gemini API key. Leave blank for the local fallback pipeline | *(empty)* |
| `GEMINI_MODEL` | Generation model | `gemini-2.5-flash` |
| `GEMINI_EMBED_MODEL` | Embedding model | `text-embedding-004` |
| `UPLOAD_DIR` | Local file storage path | `./uploads` |

**frontend/.env**
| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend base URL | `http://localhost:8000` |

---

## 6. Running Locally

1. Start the backend (`uvicorn main:app --reload --port 8000`)
2. Start the frontend (`npm run dev`)
3. Sign up for an account (the first account created becomes `admin`)
4. Upload a compliance document (PDF/DOCX/TXT/CSV/XLSX/image/audio) from **Documents**
5. Watch it move through the pipeline live (WebSocket-driven progress)
6. Explore the generated graph under **Knowledge Graph**
7. Ask a question under **Ask Nova** — get a cited, confidence-scored answer

---

## 7. Deployment

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel / Netlify | `npm run build`, output dir `dist/`, set `VITE_API_URL` |
| Backend | Render / Railway | Use the provided `Dockerfile`, set env vars from the table above |
| Database | Supabase Postgres | Set `DATABASE_URL=postgresql://...` (SQLAlchemy will auto-create tables on boot) |

---

## 8. API Documentation

Full interactive OpenAPI docs are served at `/docs` and `/redoc` once the backend is running.

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/signup` | POST | Create an account, returns JWT |
| `/api/auth/login` | POST | Authenticate, returns JWT |
| `/api/auth/logout` | POST | Invalidate client session |
| `/api/auth/forgot-password` | POST | Trigger password reset (demo-safe) |
| `/api/upload` | POST | Upload one or more documents, kicks off async processing |
| `/api/documents` | GET | List documents with live processing status |
| `/api/document/{id}` | GET / DELETE / PATCH | Manage a single document |
| `/api/graph` | GET | Fetch the knowledge graph (nodes + edges) |
| `/api/ask` | POST | Ask a question — Hybrid Graph RAG answer with citations |
| `/api/history` | GET | Question/answer history |
| `/api/answer/{id}/bookmark` | POST | Toggle bookmark on an answer |
| `/api/analytics` | GET | Entity/relationship/document distributions |
| `/api/ws/status?token=` | WebSocket | Live document processing status |

---

## 9. Folder Structure

```
nova-ai/
├── backend/
│   ├── routers/         # auth, documents, graph, rag_router, analytics
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic request/response schemas
│   ├── graph/           # NetworkX knowledge graph builder & search
│   ├── rag/             # Hybrid Graph RAG retrieval + generation pipeline
│   ├── embeddings/      # Gemini embeddings + local fallback
│   ├── llm/             # Gemini client, extraction prompts, heuristic fallback
│   ├── auth/            # JWT + password hashing
│   ├── utils/           # File parsers, chunker, WebSocket manager
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/       # Landing, Login, Signup, Dashboard, Documents, Graph, Ask, Analytics, Settings
│   │   ├── components/  # AppShell, ConstellationBackground, ConfidenceMeter, ToastHost, ...
│   │   ├── lib/         # api client, utils
│   │   ├── store/       # Zustand auth & toast stores
│   │   └── hooks/       # WebSocket hook for live processing status
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 10. Future Improvements

- Migrate the graph layer from NetworkX to Neo4j for larger-scale, persistent graph queries (the
  `graph/graph_builder.py` module was written to make this a drop-in swap)
- Swap the local hashing-vector fallback for ChromaDB + a self-hosted embedding model for a fully
  offline-capable, higher-quality vector index
- Real Whisper/EasyOCR workers for audio transcription and scanned-image OCR (currently stubbed with
  clear in-product messaging when the API key / worker isn't configured)
- Role-based document sharing across teams, not just per-user isolation
- Export answers to PDF/Markdown/JSON and graph exports to PNG/SVG
- Refresh-token rotation and token-blacklisting for logout

---

Built for the Gen AI Hackathon — Domain 3, Problem Statement 1.
