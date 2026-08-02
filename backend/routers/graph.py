from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.models import User
from auth.security import get_current_user
from graph.graph_builder import build_graph_for_user, graph_to_api
from schemas.schemas import GraphResponse

router = APIRouter(prefix="/api", tags=["graph"])


@router.get("/graph", response_model=GraphResponse)
def get_graph(document_ids: Optional[List[str]] = Query(default=None),
              user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = build_graph_for_user(db, user.id, document_ids)
    return graph_to_api(g)
