"""
Knowledge graph construction & querying, backed by NetworkX in-process.
Architecture is intentionally modular (build_graph_for_user reads straight
from the relational store) so swapping this module for a Neo4j-backed
implementation later only touches this file, not the routers or RAG layer.
"""
from typing import List, Optional
import networkx as nx
from sqlalchemy.orm import Session

from models.models import Entity, Relationship, Document


def build_graph_for_user(
    db: Session, user_id: str, document_ids: Optional[List[str]] = None
) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()

    doc_query = db.query(Document).filter(Document.owner_id == user_id)
    if document_ids:
        doc_query = doc_query.filter(Document.id.in_(document_ids))
    docs = doc_query.all()
    doc_ids = [d.id for d in docs]
    doc_filename_map = {d.id: d.filename for d in docs}

    if not doc_ids:
        return g

    entities = db.query(Entity).filter(Entity.document_id.in_(doc_ids)).all()
    name_to_id: dict = {}
    for e in entities:
        key = e.name.strip().lower()
        if key not in name_to_id:
            name_to_id[key] = e.id
            g.add_node(
                e.id,
                label=e.name,
                type=e.type,
                description=e.description or "",
                document_id=e.document_id,
                document_name=doc_filename_map.get(e.document_id, ""),
            )

    relationships = (
        db.query(Relationship).filter(Relationship.document_id.in_(doc_ids)).all()
    )
    for r in relationships:
        src_key = r.source_entity.strip().lower()
        tgt_key = r.target_entity.strip().lower()
        src_id = name_to_id.get(src_key)
        tgt_id = name_to_id.get(tgt_key)
        if not src_id:
            src_id = f"implicit::{src_key}"
            if src_id not in g:
                g.add_node(
                    src_id,
                    label=r.source_entity,
                    type="Entity",
                    description="",
                    document_id=r.document_id,
                    document_name=doc_filename_map.get(r.document_id, ""),
                )
        if not tgt_id:
            tgt_id = f"implicit::{tgt_key}"
            if tgt_id not in g:
                g.add_node(
                    tgt_id,
                    label=r.target_entity,
                    type="Entity",
                    description="",
                    document_id=r.document_id,
                    document_name=doc_filename_map.get(r.document_id, ""),
                )
        g.add_edge(
            src_id,
            tgt_id,
            key=r.id,
            label=r.relation_type,
            confidence=r.confidence,
            id=r.id,
        )

    return g


def graph_to_api(g: nx.MultiDiGraph) -> dict:
    try:
        pr = nx.pagerank(g)
    except Exception:
        pr = {node_id: 0 for node_id in g.nodes()}

    nodes = []
    for node_id, data in g.nodes(data=True):
        nodes.append(
            {
                "id": node_id,
                "label": data.get("label", node_id),
                "type": data.get("type", "Entity"),
                "description": data.get("description", ""),
                "document_id": data.get("document_id"),
                "document_name": data.get("document_name", ""),
                "degree": g.degree(node_id),
                "centrality": round(pr.get(node_id, 0), 4),
            }
        )

    edges = []
    for u, v, key, data in g.edges(keys=True, data=True):
        edges.append(
            {
                "id": data.get("id", str(key)),
                "source": u,
                "target": v,
                "label": data.get("label", "linked_to"),
                "confidence": data.get("confidence", 0.8),
            }
        )

    node_count = g.number_of_nodes()
    edge_count = g.number_of_edges()

    # Type distribution
    type_dist: dict = {}
    for _, data in g.nodes(data=True):
        t = data.get("type", "Entity")
        type_dist[t] = type_dist.get(t, 0) + 1

    # Top connected nodes (hubs)
    top_hubs = sorted(
        [(n, g.degree(n), g.nodes[n].get("label", n)) for n in g.nodes()],
        key=lambda x: x[1],
        reverse=True,
    )[:10]

    stats = {
        "node_count": node_count,
        "edge_count": edge_count,
        "density": round(nx.density(g), 4) if node_count > 1 else 0,
        "connected_components": (
            nx.number_weakly_connected_components(g) if node_count > 0 else 0
        ),
        "type_distribution": type_dist,
        "top_hubs": [
            {"id": nid, "label": label, "degree": deg}
            for nid, deg, label in top_hubs
        ],
    }
    return {"nodes": nodes, "edges": edges, "stats": stats}


def search_graph_for_terms(
    g: nx.MultiDiGraph, terms: List[str], hops: int = 1
) -> List[str]:
    """Return node ids whose label fuzzy-matches any query term, expanded by N hops."""
    terms_lower = [t.lower() for t in terms if len(t) > 2]
    matched = set()
    for node_id, data in g.nodes(data=True):
        label = str(data.get("label", "")).lower()
        if any(t in label or label in t for t in terms_lower):
            matched.add(node_id)

    expanded = set(matched)
    frontier = set(matched)
    for _ in range(hops):
        next_frontier = set()
        for node_id in frontier:
            if node_id in g:
                next_frontier.update(g.successors(node_id))
                next_frontier.update(g.predecessors(node_id))
        next_frontier -= expanded
        expanded.update(next_frontier)
        frontier = next_frontier
    return list(expanded)


def detect_compliance_risks(g: nx.MultiDiGraph) -> List[dict]:
    """Scan the knowledge graph for compliance gaps and risks."""
    risks = []
    risk_id = 0

    # 1. Policies without governing regulation
    policies = [n for n, d in g.nodes(data=True) if d.get("type") == "Policy"]
    for pid in policies:
        has_governing = False
        for _, _, data in g.in_edges(pid, data=True):
            if data.get("label") in ("governed_by", "complies_with"):
                has_governing = True
                break
        for _, _, data in g.out_edges(pid, data=True):
            if data.get("label") in ("governed_by", "complies_with"):
                has_governing = True
                break
        if not has_governing:
            label = g.nodes[pid].get("label", pid)
            risk_id += 1
            risks.append(
                {
                    "id": f"risk-{risk_id}",
                    "severity": "high",
                    "title": f"Policy '{label}' has no linked regulation",
                    "description": (
                        f"The policy '{label}' is not connected to any regulation or compliance "
                        f"standard in the knowledge graph. This may indicate a governance gap."
                    ),
                    "affected_entities": [label],
                    "recommendation": (
                        "Link this policy to the applicable regulation or standard to ensure "
                        "compliance traceability."
                    ),
                }
            )

    # 2. Storage locations without encryption
    storage_nodes = [
        n
        for n, d in g.nodes(data=True)
        if d.get("type") in ("Storage Location", "Entity")
        and "storage" in str(d.get("label", "")).lower()
    ]
    for sid in storage_nodes:
        has_encryption = False
        for neighbor in list(g.successors(sid)) + list(g.predecessors(sid)):
            ntype = g.nodes[neighbor].get("type", "")
            for _, _, edata in list(g.edges(sid, data=True)) + list(
                g.edges(neighbor, data=True)
            ):
                if edata.get("label") in ("encrypted_with",):
                    has_encryption = True
                    break
            if ntype in ("Encryption", "Standard"):
                has_encryption = True
            if has_encryption:
                break
        if not has_encryption:
            label = g.nodes[sid].get("label", sid)
            risk_id += 1
            risks.append(
                {
                    "id": f"risk-{risk_id}",
                    "severity": "high",
                    "title": f"Storage location '{label}' has no encryption link",
                    "description": (
                        f"The storage location '{label}' is not linked to any encryption standard. "
                        "Data at rest may be unprotected."
                    ),
                    "affected_entities": [label],
                    "recommendation": (
                        "Verify that data stored in this location is encrypted and link the "
                        "appropriate encryption standard."
                    ),
                }
            )

    # 3. Isolated critical entities
    for node_id, data in g.nodes(data=True):
        deg = g.degree(node_id)
        ntype = data.get("type", "Entity")
        label = data.get("label", node_id)
        if deg == 0 and ntype in ("Regulation", "Policy", "Security Control"):
            risk_id += 1
            risks.append(
                {
                    "id": f"risk-{risk_id}",
                    "severity": "medium",
                    "title": f"Isolated {ntype}: '{label}'",
                    "description": (
                        f"The {ntype.lower()} '{label}' has no connections in the knowledge graph. "
                        "It may be referenced in documents but not linked to relevant entities."
                    ),
                    "affected_entities": [label],
                    "recommendation": (
                        f"Review the source document to identify and create relationships for this "
                        f"{ntype.lower()}."
                    ),
                }
            )

    # 4. Security controls not linked to policies
    controls = [n for n, d in g.nodes(data=True) if d.get("type") == "Security Control"]
    for cid in controls:
        has_policy = False
        for neighbor in list(g.successors(cid)) + list(g.predecessors(cid)):
            if g.nodes[neighbor].get("type") in ("Policy", "Regulation"):
                has_policy = True
                break
        if not has_policy:
            label = g.nodes[cid].get("label", cid)
            risk_id += 1
            risks.append(
                {
                    "id": f"risk-{risk_id}",
                    "severity": "medium",
                    "title": f"Security control '{label}' not linked to any policy",
                    "description": (
                        f"The security control '{label}' exists in the graph but is not connected "
                        "to any policy or regulation."
                    ),
                    "affected_entities": [label],
                    "recommendation": (
                        "Connect this control to the relevant policy to ensure proper governance coverage."
                    ),
                }
            )

    # 5. Violation relationships
    for u, v, data in g.edges(data=True):
        if data.get("label") == "violates":
            src_label = g.nodes[u].get("label", u)
            tgt_label = g.nodes[v].get("label", v)
            risk_id += 1
            risks.append(
                {
                    "id": f"risk-{risk_id}",
                    "severity": "high",
                    "title": f"Violation detected: '{src_label}' violates '{tgt_label}'",
                    "description": (
                        f"A violation relationship was identified between '{src_label}' and "
                        f"'{tgt_label}'. This requires immediate attention."
                    ),
                    "affected_entities": [src_label, tgt_label],
                    "recommendation": "Investigate and resolve this compliance violation immediately.",
                }
            )

    return risks


def impact_analysis(g: nx.MultiDiGraph, entity_name: str) -> dict:
    """BFS from a named entity to find all directly and indirectly affected nodes."""
    source_id = None
    entity_name_lower = entity_name.strip().lower()

    # Exact match first
    for node_id, data in g.nodes(data=True):
        if str(data.get("label", "")).strip().lower() == entity_name_lower:
            source_id = node_id
            break

    # Partial match fallback
    if source_id is None:
        for node_id, data in g.nodes(data=True):
            if entity_name_lower in str(data.get("label", "")).lower():
                source_id = node_id
                break

    if source_id is None:
        return {"directly_affected": [], "indirectly_affected": []}

    directly_affected = []
    indirectly_affected = []
    direct_ids = set()

    for neighbor in g.successors(source_id):
        if neighbor == source_id:
            continue
        direct_ids.add(neighbor)
        edge_data = g.get_edge_data(source_id, neighbor)
        rel_label = "linked_to"
        if edge_data:
            first_key = next(iter(edge_data))
            rel_label = edge_data[first_key].get("label", "linked_to")
        directly_affected.append(
            {
                "id": neighbor,
                "label": g.nodes[neighbor].get("label", neighbor),
                "type": g.nodes[neighbor].get("type", "Entity"),
                "impact_level": "direct",
                "relationship": rel_label,
            }
        )

    for neighbor in g.predecessors(source_id):
        if neighbor == source_id or neighbor in direct_ids:
            continue
        direct_ids.add(neighbor)
        edge_data = g.get_edge_data(neighbor, source_id)
        rel_label = "linked_to"
        if edge_data:
            first_key = next(iter(edge_data))
            rel_label = edge_data[first_key].get("label", "linked_to")
        directly_affected.append(
            {
                "id": neighbor,
                "label": g.nodes[neighbor].get("label", neighbor),
                "type": g.nodes[neighbor].get("type", "Entity"),
                "impact_level": "direct",
                "relationship": rel_label,
            }
        )

    indirect_ids: set = set()
    for did in direct_ids:
        for neighbor in list(g.successors(did)) + list(g.predecessors(did)):
            if (
                neighbor == source_id
                or neighbor in direct_ids
                or neighbor in indirect_ids
            ):
                continue
            indirect_ids.add(neighbor)
            edge_data = g.get_edge_data(did, neighbor) or g.get_edge_data(neighbor, did)
            rel_label = "linked_to"
            if edge_data:
                first_key = next(iter(edge_data))
                rel_label = edge_data[first_key].get("label", "linked_to")
            indirectly_affected.append(
                {
                    "id": neighbor,
                    "label": g.nodes[neighbor].get("label", neighbor),
                    "type": g.nodes[neighbor].get("type", "Entity"),
                    "impact_level": "indirect",
                    "relationship": rel_label,
                }
            )

    return {
        "directly_affected": directly_affected,
        "indirectly_affected": indirectly_affected,
    }
