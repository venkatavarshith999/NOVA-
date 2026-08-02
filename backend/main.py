import os
import logging
from contextlib import asynccontextmanager
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from config import get_settings
from database import Base, engine
from routers import auth, documents, graph, rag_router, analytics, compliance

logging.basicConfig(level=logging.INFO)
settings = get_settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
if settings.DATABASE_URL.startswith("sqlite"):
    os.makedirs(os.path.dirname(settings.DATABASE_URL.replace("sqlite:///", "")) or ".", exist_ok=True)

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger("nova.startup")
    if not settings.GEMINI_API_KEY:
        logger.error("CRITICAL ERROR: GEMINI_API_KEY is not set. Please set it in .env to start the application.")
        sys.exit(1)
    if not settings.TAVILY_API_KEY:
        logger.error("CRITICAL ERROR: TAVILY_API_KEY is not set. Please set it in .env to start the application.")
        sys.exit(1)
        
    logger.info("API Keys validated successfully. Nova AI is ready.")
    yield

app = FastAPI(
    title="Nova AI",
    description="Enterprise Multi-Modal Knowledge Graph & Graph RAG Compliance Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(graph.router)
app.include_router(rag_router.router)
app.include_router(analytics.router)
app.include_router(compliance.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "ai_enabled": settings.ai_enabled}


@app.get("/")
def root():
    return {"message": "Nova AI backend is running. See /docs for API reference."}
