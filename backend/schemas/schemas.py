import datetime as dt
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    n8n_webhook_url: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    n8n_webhook_url: Optional[str] = None


# ---------- Documents ----------
class DocumentOut(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    progress: int
    page_count: int
    char_count: int
    chunk_count: int
    entity_count: int
    relationship_count: int
    error_message: Optional[str] = None
    created_at: dt.datetime

    class Config:
        from_attributes = True


# ---------- Graph ----------
class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    document_id: Optional[str] = None
    degree: int = 0


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    confidence: float = 0.8


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: dict


# ---------- RAG / Q&A ----------
class AskRequest(BaseModel):
    question: str
    document_ids: Optional[List[str]] = None
    top_k: int = 6
    llm_provider: Optional[str] = None
    api_key: Optional[str] = None


class Citation(BaseModel):
    document_id: str
    filename: str
    page: Optional[int] = None
    snippet: str
    chunk_id: str


class AskResponse(BaseModel):
    question_id: str
    answer: str
    confidence: float
    citations: List[Citation]
    graph_nodes: List[str]
    related_entities: List[dict] = []


class HistoryItem(BaseModel):
    question_id: str
    question: str
    answer: Optional[str]
    confidence: Optional[float]
    created_at: dt.datetime


# ---------- Analytics ----------
class AnalyticsResponse(BaseModel):
    total_documents: int
    total_nodes: int
    total_relationships: int
    total_questions: int
    average_confidence: float
    entity_distribution: dict
    relationship_distribution: dict
    document_type_distribution: dict
    processing_status_counts: dict
    daily_activity: List[dict]


# ---------- Document Summary ----------
class DocumentSummaryResponse(BaseModel):
    document_id: str
    summary: str
    key_entities: List[dict]
    key_relationships: List[dict]
    word_count: int


# ---------- Document Comparison ----------
class CompareRequest(BaseModel):
    document_id_a: str
    document_id_b: str


class CompareResponse(BaseModel):
    document_a: dict  # {id, filename, entity_count, relationship_count}
    document_b: dict
    shared_entities: List[dict]
    unique_to_a: List[dict]
    unique_to_b: List[dict]
    relationship_diffs: List[dict]
    overlap_score: float
    summary: str


# ---------- Compliance Risk ----------
class ComplianceRisk(BaseModel):
    id: str
    severity: str  # high, medium, low
    title: str
    description: str
    affected_entities: List[str]
    recommendation: str


class ComplianceRisksResponse(BaseModel):
    risks: List[ComplianceRisk]
    total_risks: int
    high_count: int
    medium_count: int
    low_count: int
    compliance_score: float


# ---------- Impact Analysis ----------
class ImpactAnalysisRequest(BaseModel):
    entity_name: str
    change_type: str = "modification"  # modification, removal, addition


class ImpactNode(BaseModel):
    id: str
    label: str
    type: str
    impact_level: str  # direct, indirect
    relationship: str


class ImpactAnalysisResponse(BaseModel):
    source_entity: str
    change_type: str
    directly_affected: List[ImpactNode]
    indirectly_affected: List[ImpactNode]
    total_affected: int
    risk_summary: str


# ---------- Reports ----------
class ReportGenerateRequest(BaseModel):
    title: Optional[str] = None
    report_type: str = "compliance_overview"  # compliance_overview, risk_assessment, entity_summary
    document_ids: Optional[List[str]] = None


class ReportOut(BaseModel):
    id: str
    title: str
    report_type: str
    summary: Optional[str]
    risk_count: int
    entity_count: int
    relationship_count: int
    status: str
    created_at: Any

    class Config:
        from_attributes = True

