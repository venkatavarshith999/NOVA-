"""
Nova AI — Compliance-specific endpoints:
  - Document summaries
  - Document comparison
  - Risk detection
  - Impact analysis
  - Report generation & download
"""
import json
import datetime as dt
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models.models import User, Document, Entity, Relationship, Chunk, Report
from auth.security import get_current_user
from graph.graph_builder import (
    build_graph_for_user, detect_compliance_risks, impact_analysis,
)
from schemas.schemas import (
    DocumentSummaryResponse, CompareRequest, CompareResponse,
    ComplianceRisk, ComplianceRisksResponse,
    ImpactAnalysisRequest, ImpactAnalysisResponse, ImpactNode,
    ReportGenerateRequest, ReportOut,
)
from llm.gemini_client import generate_content, GeminiError

router = APIRouter(prefix="/api", tags=["compliance"])
logger = logging.getLogger("nova.compliance")


# ---------- Document Summary ----------

@router.post("/document/{doc_id}/summary", response_model=DocumentSummaryResponse)
async def summarize_document(doc_id: str, user: User = Depends(get_current_user),
                              db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.owner_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(status_code=400, detail="Document is still processing")

    chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).order_by(Chunk.chunk_index).all()
    entities = db.query(Entity).filter(Entity.document_id == doc_id).all()
    relationships = db.query(Relationship).filter(Relationship.document_id == doc_id).all()

    full_text = " ".join(c.text for c in chunks[:20])  # first 20 chunks
    word_count = len(full_text.split())

    key_entities = [{"name": e.name, "type": e.type} for e in entities[:15]]
    key_rels = [{"source": r.source_entity, "target": r.target_entity,
                 "relation": r.relation_type} for r in relationships[:15]]

    # Try Gemini summary
    try:
        prompt = (
            f"Summarize this compliance document concisely in 3-5 paragraphs. "
            f"Focus on key compliance requirements, policies, and obligations.\n\n"
            f"Document: {doc.filename}\n\n{full_text[:6000]}"
        )
        summary = await generate_content(
            prompt,
            system_instruction="You are Nova AI, a compliance document analysis assistant. Produce clear, factual summaries.",
            temperature=0.2,
        )
    except (GeminiError, Exception):
        # Fallback: extractive summary
        sentences = [s.strip() for s in full_text.split(".") if len(s.strip()) > 30]
        summary = ". ".join(sentences[:8]) + "." if sentences else "No summary could be generated."
        summary = (
            f"Summary of {doc.filename} ({doc.page_count} pages, {doc.entity_count} entities extracted):\n\n"
            + summary
            + f"\n\nKey topics: {', '.join(e['name'] for e in key_entities[:8]) or 'None identified'}."
        )

    return DocumentSummaryResponse(
        document_id=doc_id, summary=summary,
        key_entities=key_entities, key_relationships=key_rels,
        word_count=word_count,
    )


# ---------- Document Comparison ----------

@router.post("/documents/compare", response_model=CompareResponse)
def compare_documents(payload: CompareRequest, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    doc_a = db.query(Document).filter(Document.id == payload.document_id_a, Document.owner_id == user.id).first()
    doc_b = db.query(Document).filter(Document.id == payload.document_id_b, Document.owner_id == user.id).first()
    if not doc_a or not doc_b:
        raise HTTPException(status_code=404, detail="One or both documents not found")
    if doc_a.status != "ready" or doc_b.status != "ready":
        raise HTTPException(status_code=400, detail="Both documents must be fully processed")

    ents_a = db.query(Entity).filter(Entity.document_id == doc_a.id).all()
    ents_b = db.query(Entity).filter(Entity.document_id == doc_b.id).all()
    rels_a = db.query(Relationship).filter(Relationship.document_id == doc_a.id).all()
    rels_b = db.query(Relationship).filter(Relationship.document_id == doc_b.id).all()

    names_a = {e.name.strip().lower(): {"name": e.name, "type": e.type} for e in ents_a}
    names_b = {e.name.strip().lower(): {"name": e.name, "type": e.type} for e in ents_b}

    shared_keys = set(names_a.keys()) & set(names_b.keys())
    unique_a_keys = set(names_a.keys()) - shared_keys
    unique_b_keys = set(names_b.keys()) - shared_keys

    shared = [names_a[k] for k in shared_keys]
    unique_a = [names_a[k] for k in unique_a_keys]
    unique_b = [names_b[k] for k in unique_b_keys]

    # Relationship diffs
    rel_set_a = {(r.source_entity.lower(), r.relation_type, r.target_entity.lower()) for r in rels_a}
    rel_set_b = {(r.source_entity.lower(), r.relation_type, r.target_entity.lower()) for r in rels_b}
    only_a = rel_set_a - rel_set_b
    only_b = rel_set_b - rel_set_a

    rel_diffs = []
    for s, rel, t in only_a:
        rel_diffs.append({"source": s, "relation": rel, "target": t, "document": doc_a.filename})
    for s, rel, t in only_b:
        rel_diffs.append({"source": s, "relation": rel, "target": t, "document": doc_b.filename})

    total_ents = len(set(names_a.keys()) | set(names_b.keys()))
    overlap = len(shared_keys) / total_ents if total_ents > 0 else 0.0

    summary = (
        f"Compared '{doc_a.filename}' and '{doc_b.filename}'. "
        f"Found {len(shared)} shared entities, {len(unique_a)} unique to document A, "
        f"and {len(unique_b)} unique to document B. "
        f"Entity overlap: {overlap:.0%}. "
        f"{len(rel_diffs)} relationship differences detected."
    )

    return CompareResponse(
        document_a={"id": doc_a.id, "filename": doc_a.filename,
                     "entity_count": doc_a.entity_count, "relationship_count": doc_a.relationship_count},
        document_b={"id": doc_b.id, "filename": doc_b.filename,
                     "entity_count": doc_b.entity_count, "relationship_count": doc_b.relationship_count},
        shared_entities=shared, unique_to_a=unique_a, unique_to_b=unique_b,
        relationship_diffs=rel_diffs[:50], overlap_score=round(overlap, 3),
        summary=summary,
    )


# ---------- Compliance Risk Detection ----------

@router.get("/compliance/risks", response_model=ComplianceRisksResponse)
def get_compliance_risks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = build_graph_for_user(db, user.id)
    raw_risks = detect_compliance_risks(g)

    risks = [ComplianceRisk(**r) for r in raw_risks]
    high = sum(1 for r in risks if r.severity == "high")
    medium = sum(1 for r in risks if r.severity == "medium")
    low = sum(1 for r in risks if r.severity == "low")

    total_nodes = g.number_of_nodes()
    risky_nodes = len({e for r in raw_risks for e in r["affected_entities"]})
    score = max(0, round(100 - (risky_nodes / max(total_nodes, 1)) * 100, 1))

    return ComplianceRisksResponse(
        risks=risks, total_risks=len(risks),
        high_count=high, medium_count=medium, low_count=low,
        compliance_score=score,
    )


# ---------- Impact Analysis ----------

@router.post("/compliance/impact", response_model=ImpactAnalysisResponse)
def get_impact(payload: ImpactAnalysisRequest, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    g = build_graph_for_user(db, user.id)
    result = impact_analysis(g, payload.entity_name)

    directly = [ImpactNode(**n) for n in result["directly_affected"]]
    indirectly = [ImpactNode(**n) for n in result["indirectly_affected"]]
    total = len(directly) + len(indirectly)

    risk_summary = f"Changing '{payload.entity_name}' ({payload.change_type}) would affect "
    if total == 0:
        risk_summary += "no connected entities in the knowledge graph."
    else:
        risk_summary += (
            f"{len(directly)} directly connected and {len(indirectly)} indirectly connected entities. "
            f"Review all affected items before proceeding."
        )

    return ImpactAnalysisResponse(
        source_entity=payload.entity_name, change_type=payload.change_type,
        directly_affected=directly, indirectly_affected=indirectly,
        total_affected=total, risk_summary=risk_summary,
    )


# ---------- Report Generation ----------

def _classify_risk_level(compliance_score: float, high_count: int) -> str:
    """Classify overall risk level based on compliance score and high-severity risks."""
    if compliance_score < 50 or high_count >= 5:
        return "high"
    elif compliance_score < 75 or high_count >= 2:
        return "medium"
    return "low"


def _detect_missing_policies(entities, relationships, entity_breakdown) -> list:
    """Heuristic detection of missing policies based on entity and relationship patterns."""
    missing = []
    entity_types = set(entity_breakdown.keys())
    entity_names_lower = {e.name.lower() for e in entities}
    rel_types = {r.relation_type.lower() for r in relationships}

    # Check for common compliance areas that should have policies
    compliance_areas = [
        ("Data Retention", ["data retention", "retention policy", "data lifecycle"]),
        ("Access Control", ["access control", "authorization", "role-based access"]),
        ("Incident Response", ["incident response", "breach notification", "security incident"]),
        ("Data Classification", ["data classification", "information classification", "sensitivity"]),
        ("Third-Party Risk", ["third party", "vendor management", "supplier risk"]),
        ("Employee Training", ["security training", "awareness program", "compliance training"]),
        ("Audit & Monitoring", ["audit log", "monitoring", "surveillance", "logging"]),
        ("Encryption Standards", ["encryption", "cryptographic", "cipher"]),
        ("Change Management", ["change management", "change control", "version control"]),
        ("Business Continuity", ["business continuity", "disaster recovery", "backup"]),
    ]

    for area_name, keywords in compliance_areas:
        found = any(kw in name for name in entity_names_lower for kw in keywords)
        if not found:
            missing.append({
                "area": area_name,
                "severity": "high" if area_name in ["Incident Response", "Access Control", "Data Retention"] else "medium",
                "recommendation": f"No {area_name} policy or control detected in uploaded documents. "
                                  f"Consider adding a formal {area_name} policy document.",
            })
    return missing[:8]


def _identify_regulations(entities, entity_breakdown) -> list:
    """Identify regulations mentioned in the knowledge graph."""
    regulations = []
    known_regs = {
        "gdpr": {"name": "GDPR", "full_name": "General Data Protection Regulation", "region": "EU"},
        "hipaa": {"name": "HIPAA", "full_name": "Health Insurance Portability and Accountability Act", "region": "US"},
        "sox": {"name": "SOX", "full_name": "Sarbanes-Oxley Act", "region": "US"},
        "pci dss": {"name": "PCI DSS", "full_name": "Payment Card Industry Data Security Standard", "region": "Global"},
        "ccpa": {"name": "CCPA", "full_name": "California Consumer Privacy Act", "region": "US"},
        "iso 27001": {"name": "ISO 27001", "full_name": "Information Security Management System", "region": "Global"},
        "nist": {"name": "NIST", "full_name": "National Institute of Standards and Technology Framework", "region": "US"},
        "ferpa": {"name": "FERPA", "full_name": "Family Educational Rights and Privacy Act", "region": "US"},
        "glba": {"name": "GLBA", "full_name": "Gramm-Leach-Bliley Act", "region": "US"},
        "dora": {"name": "DORA", "full_name": "Digital Operational Resilience Act", "region": "EU"},
    }

    # Check entity names for regulation references
    reg_type_entities = entity_breakdown.get("Regulation", []) + entity_breakdown.get("Standard", []) + entity_breakdown.get("Framework", [])
    all_names = [e.name.lower() for e in entities] + [n.lower() for n in reg_type_entities]

    seen = set()
    for name in all_names:
        for key, info in known_regs.items():
            if key in name and info["name"] not in seen:
                seen.add(info["name"])
                regulations.append(info)

    # If entities of type Regulation exist but didn't match known regs, add them generically
    for name in reg_type_entities[:5]:
        if name not in seen:
            seen.add(name)
            regulations.append({"name": name, "full_name": name, "region": "Unknown"})

    return regulations


def _generate_recommendations(risks, missing_policies, compliance_score, entity_count, rel_count) -> list:
    """Generate AI recommendations based on analysis results."""
    recs = []

    high_risks = [r for r in risks if r.get("severity") == "high"]
    if high_risks:
        recs.append({
            "priority": "critical",
            "title": "Address High-Severity Compliance Risks",
            "description": f"{len(high_risks)} high-severity risk(s) detected. "
                           f"Immediate remediation is recommended for: {', '.join(r['title'] for r in high_risks[:3])}.",
        })

    if missing_policies:
        high_missing = [m for m in missing_policies if m["severity"] == "high"]
        if high_missing:
            recs.append({
                "priority": "high",
                "title": "Establish Critical Missing Policies",
                "description": f"The following critical policy areas are not covered: "
                               f"{', '.join(m['area'] for m in high_missing)}. "
                               f"These are fundamental compliance requirements.",
            })

    if compliance_score < 60:
        recs.append({
            "priority": "high",
            "title": "Improve Overall Compliance Posture",
            "description": f"Current compliance score is {compliance_score}%. "
                           f"Target a minimum of 75% by addressing identified gaps and risks.",
        })
    elif compliance_score < 80:
        recs.append({
            "priority": "medium",
            "title": "Strengthen Compliance Framework",
            "description": f"Compliance score of {compliance_score}% shows moderate coverage. "
                           f"Focus on closing remaining gaps to reach enterprise-grade compliance.",
        })

    if entity_count < 10:
        recs.append({
            "priority": "medium",
            "title": "Upload Additional Compliance Documents",
            "description": "The knowledge graph contains limited entities. "
                           "Upload more policy documents, regulatory frameworks, and internal controls "
                           "for a comprehensive compliance picture.",
        })

    if rel_count > 0 and entity_count > 0:
        density = rel_count / max(entity_count, 1)
        if density < 1.5:
            recs.append({
                "priority": "low",
                "title": "Enrich Entity Relationships",
                "description": "The knowledge graph has low relationship density. "
                               "Consider uploading documents that map control-to-risk and policy-to-regulation relationships.",
            })

    recs.append({
        "priority": "low",
        "title": "Schedule Regular Compliance Reviews",
        "description": "Establish a quarterly compliance review cycle to regenerate reports "
                       "and track compliance posture over time.",
    })

    return recs


def _build_citations(docs, chunks_by_doc) -> list:
    """Build citation entries with page references."""
    citations = []
    for doc in docs:
        doc_chunks = chunks_by_doc.get(doc.id, [])
        pages = sorted(set(c.page_number for c in doc_chunks if c.page_number))
        citations.append({
            "document_id": doc.id,
            "filename": doc.filename,
            "pages": pages[:20],
            "page_range": f"Pages {pages[0]}-{pages[-1]}" if len(pages) >= 2 else (f"Page {pages[0]}" if pages else "All pages"),
            "chunks_analyzed": len(doc_chunks),
            "entity_count": doc.entity_count,
            "relationship_count": doc.relationship_count,
        })
    return citations


def send_n8n_webhook(url: str, payload: dict):
    try:
        import requests
        resp = requests.post(url, json=payload, timeout=10)
        logger.info(f"n8n webhook fired to {url}: {resp.status_code}")
    except Exception as e:
        logger.error(f"Failed to fire n8n webhook to {url}: {e}")

@router.post("/reports/generate", response_model=ReportOut, status_code=201)
async def generate_report(payload: ReportGenerateRequest, background_tasks: BackgroundTasks, user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    g = build_graph_for_user(db, user.id, payload.document_ids)
    risks = detect_compliance_risks(g)

    # Gather data
    doc_query = db.query(Document).filter(Document.owner_id == user.id, Document.status == "ready")
    if payload.document_ids:
        doc_query = doc_query.filter(Document.id.in_(payload.document_ids))
    docs = doc_query.all()
    doc_ids = [d.id for d in docs]

    entities = db.query(Entity).filter(Entity.document_id.in_(doc_ids)).all() if doc_ids else []
    relationships = db.query(Relationship).filter(Relationship.document_id.in_(doc_ids)).all() if doc_ids else []
    chunks = db.query(Chunk).filter(Chunk.document_id.in_(doc_ids)).all() if doc_ids else []

    # Build chunks-by-doc lookup
    chunks_by_doc = {}
    for c in chunks:
        chunks_by_doc.setdefault(c.document_id, []).append(c)

    entity_summary = {}
    for e in entities:
        entity_summary.setdefault(e.type, []).append(e.name)
    entity_breakdown = {k: list(set(v))[:20] for k, v in entity_summary.items()}

    rel_summary = {}
    for r in relationships:
        rel_summary.setdefault(r.relation_type, []).append(
            {"source": r.source_entity, "target": r.target_entity}
        )

    # Compliance score
    total_nodes = g.number_of_nodes()
    risky_nodes = len({e for r in risks for e in r["affected_entities"]})
    compliance_score = max(0, round(100 - (risky_nodes / max(total_nodes, 1)) * 100, 1))

    high_count = sum(1 for r in risks if r["severity"] == "high")
    medium_count = sum(1 for r in risks if r["severity"] == "medium")
    low_count = sum(1 for r in risks if r["severity"] == "low")
    risk_level = _classify_risk_level(compliance_score, high_count)

    # Missing policies
    missing_policies = _detect_missing_policies(entities, relationships, entity_breakdown)

    # Key regulations
    key_regulations = _identify_regulations(entities, entity_breakdown)

    # Recommendations
    recommendations = _generate_recommendations(risks, missing_policies, compliance_score, len(entities), len(relationships))

    # Citations
    citations = _build_citations(docs, chunks_by_doc)

    # Confidence score (based on data quality)
    data_quality_factors = [
        min(len(docs) / 5, 1.0) * 30,         # More docs = higher confidence (up to 30%)
        min(len(entities) / 50, 1.0) * 25,     # More entities = higher confidence
        min(len(relationships) / 30, 1.0) * 20, # More relationships
        min(total_nodes / 20, 1.0) * 15,       # Graph coverage
        (1 - len(missing_policies) / 10) * 10,  # Fewer missing policies = higher confidence
    ]
    confidence_score = round(max(5, min(99, sum(data_quality_factors))), 1)

    title = payload.title or f"Enterprise Compliance Report — {dt.datetime.utcnow().strftime('%B %d, %Y %H:%M UTC')}"

    # Generate executive summary
    exec_summary_parts = [
        f"This Enterprise Compliance Report provides a comprehensive analysis of {len(docs)} document(s) "
        f"containing {len(entities)} compliance entities and {len(relationships)} control relationships.",
    ]
    if risks:
        exec_summary_parts.append(
            f"\n\nRisk Assessment: {len(risks)} compliance risk(s) identified — "
            f"{high_count} high, {medium_count} medium, {low_count} low severity. "
            f"Overall compliance score: {compliance_score}% ({risk_level.upper()} risk level)."
        )
    else:
        exec_summary_parts.append(
            f"\n\nNo compliance risks detected in the current document set. "
            f"Overall compliance score: {compliance_score}%."
        )
    if missing_policies:
        exec_summary_parts.append(
            f"\n\n{len(missing_policies)} potential policy gap(s) identified requiring attention."
        )
    if key_regulations:
        exec_summary_parts.append(
            f"\n\nKey regulations referenced: {', '.join(r['name'] for r in key_regulations[:5])}."
        )
    executive_summary = "".join(exec_summary_parts)

    # Try Gemini for a better executive summary
    try:
        entity_names = [e.name for e in entities[:30]]
        risk_titles = [r["title"] for r in risks[:10]]
        prompt = (
            f"Write a concise executive summary (3-4 paragraphs) for an Enterprise Compliance Report.\n\n"
            f"Documents analyzed: {len(docs)}\n"
            f"Entities extracted: {len(entities)} (types: {', '.join(entity_breakdown.keys())})\n"
            f"Relationships mapped: {len(relationships)}\n"
            f"Compliance score: {compliance_score}%\n"
            f"Risk level: {risk_level}\n"
            f"High-severity risks: {high_count}\n"
            f"Key entities: {', '.join(entity_names[:15])}\n"
            f"Risk titles: {', '.join(risk_titles[:5])}\n"
            f"Missing policy areas: {', '.join(m['area'] for m in missing_policies[:5])}\n"
            f"Regulations identified: {', '.join(r['name'] for r in key_regulations[:5])}\n\n"
            f"Be professional and concise. Focus on actionable insights for management."
        )
        ai_summary = await generate_content(
            prompt,
            system_instruction="You are an enterprise compliance analyst writing a professional audit report executive summary. Be factual, concise, and actionable.",
            temperature=0.3,
        )
        executive_summary = ai_summary
    except Exception as e:
        logger.error(f"AI API failed during report generation: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"Failed to generate AI executive summary: {str(e)}")

    content = {
        "generated_at": dt.datetime.utcnow().isoformat(),
        "executive_summary": executive_summary,
        "compliance_score": compliance_score,
        "risk_level": risk_level,
        "confidence_score": confidence_score,
        "documents_analyzed": [{"id": d.id, "filename": d.filename, "pages": d.page_count,
                                 "entities": d.entity_count, "relationships": d.relationship_count}
                                for d in docs],
        "entity_breakdown": entity_breakdown,
        "relationship_breakdown": {k: v[:15] for k, v in rel_summary.items()},
        "graph_stats": {
            "total_nodes": g.number_of_nodes(),
            "total_edges": g.number_of_edges(),
            "density": round(float(g.number_of_edges()) / max(g.number_of_nodes() * (g.number_of_nodes() - 1), 1), 4),
        },
        "risks": risks[:30],
        "missing_policies": missing_policies,
        "key_regulations": key_regulations,
        "recommendations": recommendations,
        "citations": citations,
        "risk_counts": {"high": high_count, "medium": medium_count, "low": low_count},
    }

    summary = executive_summary[:500]

    report = Report(
        owner_id=user.id, title=title, report_type=payload.report_type,
        scope={"document_ids": doc_ids},
        content=content, summary=summary,
        risk_count=len(risks), entity_count=len(entities),
        relationship_count=len(relationships), status="ready",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Trigger n8n Webhook if configured
    if user.n8n_webhook_url:
        webhook_payload = {
            "event": "report_generated",
            "report_id": report.id,
            "title": report.title,
            "risk_level": risk_level,
            "compliance_score": compliance_score,
            "high_risks": high_count,
            "summary": summary
        }
        background_tasks.add_task(send_n8n_webhook, user.n8n_webhook_url, webhook_payload)

    return ReportOut.model_validate(report)


@router.get("/reports", response_model=List[ReportOut])
def list_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reports = (db.query(Report).filter(Report.owner_id == user.id)
               .order_by(Report.created_at.desc()).all())
    return [ReportOut.model_validate(r) for r in reports]


@router.get("/reports/{report_id}")
def get_report(report_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id, Report.owner_id == user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": report.id, "title": report.title, "report_type": report.report_type,
        "summary": report.summary, "content": report.content,
        "risk_count": report.risk_count, "entity_count": report.entity_count,
        "relationship_count": report.relationship_count,
        "status": report.status, "created_at": report.created_at,
    }


@router.delete("/reports/{report_id}", status_code=204)
def delete_report(report_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id, Report.owner_id == user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return None
