import datetime as dt
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.models import User, Document, Entity, Relationship, Question, Answer
from auth.security import get_current_user
from schemas.schemas import AnalyticsResponse

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.owner_id == user.id).all()
    doc_ids = [d.id for d in docs]

    entities = db.query(Entity).filter(Entity.document_id.in_(doc_ids)).all() if doc_ids else []
    relationships = db.query(Relationship).filter(Relationship.document_id.in_(doc_ids)).all() if doc_ids else []
    questions = db.query(Question).filter(Question.user_id == user.id).all()
    answers = db.query(Answer).join(Question).filter(Question.user_id == user.id).all()

    entity_dist = dict(Counter(e.type for e in entities))
    rel_dist = dict(Counter(r.relation_type for r in relationships))
    doc_type_dist = dict(Counter(d.file_type for d in docs))
    status_counts = dict(Counter(d.status for d in docs))

    avg_conf = round(sum(a.confidence for a in answers) / len(answers), 1) if answers else 0.0

    daily = defaultdict(int)
    for q in questions:
        day = q.created_at.strftime("%Y-%m-%d")
        daily[day] += 1
    today = dt.datetime.utcnow().date()
    daily_activity = []
    for i in range(6, -1, -1):
        day = (today - dt.timedelta(days=i)).strftime("%Y-%m-%d")
        daily_activity.append({"date": day, "questions": daily.get(day, 0)})

    return AnalyticsResponse(
        total_documents=len(docs),
        total_nodes=len(entities),
        total_relationships=len(relationships),
        total_questions=len(questions),
        average_confidence=avg_conf,
        entity_distribution=entity_dist,
        relationship_distribution=rel_dist,
        document_type_distribution=doc_type_dist,
        processing_status_counts=status_counts,
        daily_activity=daily_activity,
    )
