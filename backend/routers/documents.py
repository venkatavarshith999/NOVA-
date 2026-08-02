import os
import uuid
import shutil
import asyncio
import logging
import datetime as dt
from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models.models import User, Document, Chunk, Entity, Relationship
from schemas.schemas import DocumentOut
from auth.security import get_current_user, decode_token
from config import get_settings
from utils.parsers import extract_text, chunk_text, detect_file_type
from utils.ws_manager import manager
from embeddings.embedder import get_embedding
from llm.extraction import extract_entities_relationships

router = APIRouter(prefix="/api", tags=["documents"])
logger = logging.getLogger("nova.documents")
settings = get_settings()

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv", ".xlsx", ".xls",
                       ".png", ".jpg", ".jpeg", ".mp3", ".wav", ".m4a"}


async def _push_status(user_id: str, document_id: str, status: str, progress: int, **extra):
    await manager.send_to_user(user_id, {
        "type": "processing_status", "document_id": document_id,
        "status": status, "progress": progress, **extra,
    })


async def process_document(document_id: str, user_id: str):
    """Full pipeline: extract -> chunk -> embed -> entities -> relationships -> ready."""
    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        doc.status = "extracting"; doc.progress = 10
        db.commit()
        await _push_status(user_id, document_id, "extracting", 10)

        pages = extract_text(doc.file_path)
        total_chars = sum(len(t) for _, t in pages)
        doc.page_count = len(pages)
        doc.char_count = total_chars
        doc.status = "chunking"; doc.progress = 25
        db.commit()
        await _push_status(user_id, document_id, "chunking", 25)

        chunks = chunk_text(pages)
        if not chunks:
            doc.status = "failed"
            doc.error_message = "No extractable text found in document."
            db.commit()
            await _push_status(user_id, document_id, "failed", 100, error=doc.error_message)
            return

        doc.status = "embedding"; doc.progress = 40
        db.commit()
        await _push_status(user_id, document_id, "embedding", 40)

        chunk_rows = []
        for c in chunks:
            embedding = await get_embedding(c["text"])
            row = Chunk(document_id=doc.id, text=c["text"], chunk_index=c["index"],
                        page_number=c["page"], embedding_vector=embedding)
            db.add(row)
            chunk_rows.append(row)
        doc.chunk_count = len(chunk_rows)
        db.commit()

        doc.status = "extracting_entities"; doc.progress = 65
        db.commit()
        await _push_status(user_id, document_id, "extracting_entities", 65)

        entity_count, rel_count = 0, 0
        # Cap the number of chunks sent for entity extraction to keep processing snappy
        sample_chunks = chunk_rows[:40]
        for row in sample_chunks:
            result = await extract_entities_relationships(row.text)
            local_names = set()
            for e in result.get("entities", []):
                name = str(e.get("name", "")).strip()
                if not name or len(name) < 2:
                    continue
                ent = Entity(document_id=doc.id, name=name, type=e.get("type", "Entity"),
                             description=e.get("description", "")[:500], source_chunk_id=row.id)
                db.add(ent)
                local_names.add(name)
                entity_count += 1
            for r in result.get("relationships", []):
                src, tgt = str(r.get("source", "")).strip(), str(r.get("target", "")).strip()
                if not src or not tgt:
                    continue
                rel = Relationship(document_id=doc.id, source_entity=src, target_entity=tgt,
                                    relation_type=r.get("relation", "linked_to"),
                                    source_chunk_id=row.id, confidence=float(r.get("confidence", 0.75)))
                db.add(rel)
                rel_count += 1
        doc.entity_count = entity_count
        doc.relationship_count = rel_count
        doc.status = "building_graph"; doc.progress = 90
        db.commit()
        await _push_status(user_id, document_id, "building_graph", 90)

        doc.status = "ready"
        doc.progress = 100
        doc.processed_at = dt.datetime.utcnow()
        db.commit()
        await _push_status(user_id, document_id, "ready", 100,
                            entity_count=entity_count, relationship_count=rel_count)

    except Exception as e:
        logger.exception("Document processing failed")
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "failed"
                doc.error_message = str(e)[:500]
                db.commit()
            await _push_status(user_id, document_id, "failed", 100, error=str(e)[:300])
        except Exception:
            pass
    finally:
        db.close()


@router.post("/upload", response_model=List[DocumentOut], status_code=201)
async def upload_documents(files: List[UploadFile] = File(...), user: User = Depends(get_current_user),
                            db: Session = Depends(get_db)):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    created = []
    for f in files:
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        contents = await f.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"{f.filename} exceeds 25MB limit")

        safe_name = f"{uuid.uuid4()}{ext}"
        dest_path = os.path.join(settings.UPLOAD_DIR, safe_name)
        with open(dest_path, "wb") as out:
            out.write(contents)

        doc = Document(owner_id=user.id, filename=f.filename, file_type=detect_file_type(f.filename),
                        file_path=dest_path, file_size=len(contents), status="queued", progress=0)
        db.add(doc)
        db.commit()
        db.refresh(doc)
        created.append(doc)

        asyncio.create_task(process_document(doc.id, user.id))

    return [DocumentOut.model_validate(d) for d in created]


@router.get("/documents", response_model=List[DocumentOut])
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.owner_id == user.id).order_by(Document.created_at.desc()).all()
    return [DocumentOut.model_validate(d) for d in docs]


@router.get("/document/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.owner_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut.model_validate(doc)


@router.delete("/document/{doc_id}", status_code=204)
def delete_document(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.owner_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass
    db.query(Entity).filter(Entity.document_id == doc_id).delete()
    db.query(Relationship).filter(Relationship.document_id == doc_id).delete()
    db.query(Chunk).filter(Chunk.document_id == doc_id).delete()
    db.delete(doc)
    db.commit()
    return None


@router.patch("/document/{doc_id}/rename", response_model=DocumentOut)
def rename_document(doc_id: str, new_name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.owner_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.filename = new_name
    db.commit()
    db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.websocket("/ws/status")
async def websocket_status(websocket: WebSocket, token: str):
    user_id = decode_token(token)
    if not user_id:
        await websocket.close(code=4401)
        return
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
