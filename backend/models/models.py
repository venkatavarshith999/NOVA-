import uuid
import datetime as dt
from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Text, Float, Integer, Boolean, JSON
)
from sqlalchemy.orm import relationship
from database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="analyst")  # admin | analyst | viewer
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=gen_id)
    owner_id = Column(String, ForeignKey("users.id"))
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # pdf, docx, txt, csv, xlsx, image
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, default=0)
    status = Column(String, default="queued")  # queued, extracting, chunking, embedding, extracting_entities, building_graph, ready, failed
    progress = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    page_count = Column(Integer, default=0)
    char_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    entity_count = Column(Integer, default=0)
    relationship_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(String, primary_key=True, default=gen_id)
    document_id = Column(String, ForeignKey("documents.id"))
    text = Column(Text, nullable=False)
    chunk_index = Column(Integer, default=0)
    page_number = Column(Integer, nullable=True)
    embedding_vector = Column(JSON, nullable=True)  # list[float]

    document = relationship("Document", back_populates="chunks")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, default=gen_id)
    document_id = Column(String, ForeignKey("documents.id"))
    name = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)  # Organization, Department, Country, Person, Policy, Regulation, ...
    description = Column(Text, nullable=True)
    source_chunk_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    document = relationship("Document", back_populates="entities")


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, default=gen_id)
    document_id = Column(String, ForeignKey("documents.id"))
    source_entity = Column(String, nullable=False)
    target_entity = Column(String, nullable=False)
    relation_type = Column(String, nullable=False)  # stored_in, encrypted_with, approved_by, ...
    source_chunk_id = Column(String, nullable=True)
    confidence = Column(Float, default=0.8)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"))
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    user = relationship("User", back_populates="questions")
    answer = relationship("Answer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(String, primary_key=True, default=gen_id)
    question_id = Column(String, ForeignKey("questions.id"))
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0)
    citations = Column(JSON, default=list)  # [{document, page, snippet, chunk_id}]
    graph_nodes = Column(JSON, default=list)  # entity ids used as evidence
    bookmarked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    question = relationship("Question", back_populates="answer")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=gen_id)
    owner_id = Column(String, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    report_type = Column(String, default="compliance_overview")  # compliance_overview, risk_assessment, entity_summary
    scope = Column(JSON, default=dict)  # {document_ids: [...], entity_types: [...]}
    content = Column(JSON, default=dict)  # full structured report data
    summary = Column(Text, nullable=True)
    risk_count = Column(Integer, default=0)
    entity_count = Column(Integer, default=0)
    relationship_count = Column(Integer, default=0)
    status = Column(String, default="generating")  # generating, ready, failed
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    owner = relationship("User")
