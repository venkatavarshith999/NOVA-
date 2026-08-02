import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("nova_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("nova_token");
      localStorage.removeItem("nova_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ---------- Types ----------
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  progress: number;
  page_count: number;
  char_count: number;
  chunk_count: number;
  entity_count: number;
  relationship_count: number;
  error_message: string | null;
  created_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  document_id: string | null;
  degree: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { node_count: number; edge_count: number; density: number; connected_components: number };
}

export interface Citation {
  document_id: string;
  filename: string;
  page: number | null;
  snippet: string;
  chunk_id: string;
}

export interface AskResponse {
  question_id: string;
  answer: string;
  confidence: number;
  citations: Citation[];
  graph_nodes: string[];
  related_entities: { id: string; label: string; type: string }[];
}

export interface HistoryItem {
  question_id: string;
  question: string;
  answer: string | null;
  confidence: number | null;
  created_at: string;
}

export interface AnalyticsResponse {
  total_documents: number;
  total_nodes: number;
  total_relationships: number;
  total_questions: number;
  average_confidence: number;
  entity_distribution: Record<string, number>;
  relationship_distribution: Record<string, number>;
  document_type_distribution: Record<string, number>;
  processing_status_counts: Record<string, number>;
  daily_activity: { date: string; questions: number }[];
}

export interface DocumentSummaryResponse {
  document_id: string;
  summary: string;
  key_entities: { name: string; type: string }[];
  key_relationships: { source: string; target: string; relation: string }[];
  word_count: number;
}

export interface CompareResponse {
  document_a: { id: string; filename: string; entity_count: number; relationship_count: number };
  document_b: { id: string; filename: string; entity_count: number; relationship_count: number };
  shared_entities: { name: string; type: string }[];
  unique_to_a: { name: string; type: string }[];
  unique_to_b: { name: string; type: string }[];
  relationship_diffs: { source: string; relation: string; target: string; document: string }[];
  overlap_score: number;
  summary: string;
}

export interface ComplianceRisk {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  affected_entities: string[];
  recommendation: string;
}

export interface ComplianceRisksResponse {
  risks: ComplianceRisk[];
  total_risks: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  compliance_score: number;
}

export interface ImpactNode {
  id: string;
  label: string;
  type: string;
  impact_level: "direct" | "indirect";
  relationship: string;
}

export interface ImpactAnalysisResponse {
  source_entity: string;
  change_type: string;
  directly_affected: ImpactNode[];
  indirectly_affected: ImpactNode[];
  total_affected: number;
  risk_summary: string;
}

export interface ReportItem {
  id: string;
  title: string;
  report_type: string;
  summary: string | null;
  risk_count: number;
  entity_count: number;
  relationship_count: number;
  status: string;
  created_at: string;
}

export interface ReportDetail extends ReportItem {
  content: {
    generated_at: string;
    executive_summary: string;
    compliance_score: number;
    risk_level: "high" | "medium" | "low";
    confidence_score: number;
    documents_analyzed: { id: string; filename: string; pages: number; entities: number; relationships: number }[];
    entity_breakdown: Record<string, string[]>;
    relationship_breakdown: Record<string, { source: string; target: string }[]>;
    graph_stats: { total_nodes: number; total_edges: number; density: number };
    risks: ComplianceRisk[];
    missing_policies: { area: string; severity: string; recommendation: string }[];
    key_regulations: { name: string; full_name: string; region: string }[];
    recommendations: { priority: string; title: string; description: string }[];
    citations: { document_id: string; filename: string; pages: number[]; page_range: string; chunks_analyzed: number; entity_count: number; relationship_count: number }[];
    risk_counts: { high: number; medium: number; low: number };
  };
}

// ---------- Endpoints ----------
export const authApi = {
  signup: (data: { full_name: string; email: string; password: string }) =>
    api.post<{ access_token: string; user: User }>("/api/auth/signup", data),
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; user: User }>("/api/auth/login", data),
  me: () => api.get<User>("/api/auth/me"),
};

export const documentsApi = {
  upload: (files: File[], onProgress?: (pct: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return api.post<DocumentItem[]>("/api/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    });
  },
  list: () => api.get<DocumentItem[]>("/api/documents"),
  get: (id: string) => api.get<DocumentItem>(`/api/document/${id}`),
  remove: (id: string) => api.delete(`/api/document/${id}`),
  rename: (id: string, new_name: string) =>
    api.patch<DocumentItem>(`/api/document/${id}/rename`, null, { params: { new_name } }),
  summary: (id: string) => api.post<DocumentSummaryResponse>(`/api/document/${id}/summary`),
  compare: (idA: string, idB: string) =>
    api.post<CompareResponse>("/api/documents/compare", { document_id_a: idA, document_id_b: idB }),
};

export const graphApi = {
  get: (documentIds?: string[]) =>
    api.get<GraphResponse>("/api/graph", { params: documentIds ? { document_ids: documentIds } : {} }),
};

export const ragApi = {
  ask: (question: string, document_ids?: string[], llm_provider?: string, api_key?: string) =>
    api.post<AskResponse>("/api/ask", { question, document_ids, top_k: 6, llm_provider, api_key }),
  history: () => api.get<HistoryItem[]>("/api/history"),
  bookmark: (answerId: string) => api.post(`/api/answer/${answerId}/bookmark`),
  bookmarks: () => api.get<HistoryItem[]>("/api/bookmarks"),
};

export const analyticsApi = {
  get: () => api.get<AnalyticsResponse>("/api/analytics"),
};

export const complianceApi = {
  risks: () => api.get<ComplianceRisksResponse>("/api/compliance/risks"),
  impact: (entityName: string, changeType: string = "modification") =>
    api.post<ImpactAnalysisResponse>("/api/compliance/impact", { entity_name: entityName, change_type: changeType }),
};

export const reportsApi = {
  generate: (params: { title?: string; report_type?: string; document_ids?: string[] }) =>
    api.post<ReportItem>("/api/reports/generate", params),
  list: () => api.get<ReportItem[]>("/api/reports"),
  get: (id: string) => api.get<ReportDetail>(`/api/reports/${id}`),
  remove: (id: string) => api.delete(`/api/reports/${id}`),
};
