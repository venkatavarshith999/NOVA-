import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Upload, FileText, FileSpreadsheet, Image as ImageIcon, FileAudio, File as FileIcon,
  Trash2, Pencil, Search, Loader2, CheckCircle2, XCircle, X, Sparkles, GitCompareArrows,
} from "lucide-react";
import { documentsApi, type DocumentItem } from "../lib/api";
import { useProcessingSocket } from "../hooks/useProcessingSocket";
import { useToastStore } from "../store/toastStore";
import { formatBytes, formatRelativeTime, cn } from "../lib/utils";
import DocumentSummaryModal from "../components/DocumentSummaryModal";

const TYPE_ICON: Record<string, any> = {
  pdf: FileText, docx: FileText, txt: FileText, csv: FileSpreadsheet,
  xlsx: FileSpreadsheet, image: ImageIcon, audio: FileAudio,
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  queued: { label: "Queued", color: "text-slate-400" },
  extracting: { label: "Extracting text", color: "text-azure-400" },
  chunking: { label: "Chunking", color: "text-azure-400" },
  embedding: { label: "Embedding", color: "text-violet-400" },
  extracting_entities: { label: "Extracting entities", color: "text-violet-400" },
  building_graph: { label: "Building graph", color: "text-cyan-400" },
  ready: { label: "Ready", color: "text-mint-400" },
  failed: { label: "Failed", color: "text-coral-400" },
};

export default function Documents() {
  useProcessingSocket();
  const queryClient = useQueryClient();
  const push = useToastStore((s) => s.push);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [summaryDoc, setSummaryDoc] = useState<{ id: string; filename: string } | null>(null);

  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list().then((r) => r.data),
    refetchInterval: 5000,
  });

  const filtered = (docs ?? []).filter((d) => d.filename.toLowerCase().includes(search.toLowerCase()));

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      await documentsApi.upload(arr);
      push(`${arr.length} document${arr.length > 1 ? "s" : ""} uploaded — processing started`, "success");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (err: any) {
      push(err?.response?.data?.detail || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }, [push, queryClient]);

  const handleDelete = async (id: string) => {
    try {
      await documentsApi.remove(id);
      push("Document deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    } catch {
      push("Failed to delete document", "error");
    }
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await documentsApi.rename(id, renameValue.trim());
      push("Document renamed", "success");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch {
      push("Failed to rename document", "error");
    } finally {
      setRenameId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Documents</h1>
          <p className="text-sm text-slate-400 mt-1">Upload compliance documents to feed the knowledge graph.</p>
        </div>
        <Link to="/compare" className="btn-secondary text-sm">
          <GitCompareArrows size={15} /> Compare Documents
        </Link>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "card border-dashed cursor-pointer text-center py-14 transition-colors",
          dragOver ? "border-violet-400/60 bg-violet-500/[0.06]" : "hover:border-white/20"
        )}
      >
        <input
          ref={fileInputRef} type="file" multiple hidden
          accept=".pdf,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.mp3,.wav,.m4a"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 size={28} className="mx-auto text-violet-400 animate-spin mb-3" />
        ) : (
          <Upload size={28} className="mx-auto text-violet-400 mb-3" />
        )}
        <p className="font-medium">{uploading ? "Uploading…" : "Drag & drop files, or click to browse"}</p>
        <p className="text-xs text-slate-500 mt-1.5">PDF, DOCX, TXT, CSV, XLSX, images, audio — up to 25MB each</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input-field pl-9" placeholder="Search files…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <FileIcon size={28} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">{docs?.length ? "No documents match your search." : "No documents yet — upload your first compliance file above."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DocRow
              key={d.id} doc={d}
              renaming={renameId === d.id}
              renameValue={renameValue}
              onStartRename={() => { setRenameId(d.id); setRenameValue(d.filename); }}
              onRenameChange={setRenameValue}
              onRenameSubmit={() => handleRename(d.id)}
              onRenameCancel={() => setRenameId(null)}
              onDelete={() => handleDelete(d.id)}
              onSummarize={() => setSummaryDoc({ id: d.id, filename: d.filename })}
            />
          ))}
        </div>
      )}

      {/* Summary modal */}
      {summaryDoc && (
        <DocumentSummaryModal
          documentId={summaryDoc.id}
          filename={summaryDoc.filename}
          open={!!summaryDoc}
          onClose={() => setSummaryDoc(null)}
        />
      )}
    </div>
  );
}

function DocRow({
  doc, renaming, renameValue, onStartRename, onRenameChange, onRenameSubmit, onRenameCancel, onDelete, onSummarize,
}: {
  doc: DocumentItem; renaming: boolean; renameValue: string;
  onStartRename: () => void; onRenameChange: (v: string) => void;
  onRenameSubmit: () => void; onRenameCancel: () => void; onDelete: () => void;
  onSummarize: () => void;
}) {
  const Icon = TYPE_ICON[doc.file_type] ?? FileIcon;
  const meta = STATUS_META[doc.status] ?? { label: doc.status, color: "text-slate-400" };
  const isProcessing = !["ready", "failed"].includes(doc.status);

  return (
    <div className="card py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-void-700 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus value={renameValue} onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onRenameSubmit()}
              className="input-field py-1.5 text-sm max-w-xs"
            />
            <button onClick={onRenameSubmit} className="text-mint-400"><CheckCircle2 size={16} /></button>
            <button onClick={onRenameCancel} className="text-slate-500"><X size={16} /></button>
          </div>
        ) : (
          <p className="text-sm font-medium truncate">{doc.filename}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>{formatBytes(doc.file_size)}</span>
          <span>·</span>
          <span>{formatRelativeTime(doc.created_at)}</span>
          {doc.status === "ready" && (
            <>
              <span>·</span>
              <span>{doc.entity_count} entities</span>
              <span>·</span>
              <span>{doc.relationship_count} relationships</span>
            </>
          )}
        </div>
        {isProcessing && (
          <div className="w-full max-w-xs h-1 bg-void-700 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-nova-gradient transition-all duration-500" style={{ width: `${doc.progress}%` }} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isProcessing && <Loader2 size={14} className="animate-spin text-violet-400" />}
        {doc.status === "failed" && <XCircle size={14} className="text-coral-400" aria-label={doc.error_message ?? "Failed"} />}
        <span className={cn("text-xs font-medium hidden sm:block mr-1", meta.color)}>{meta.label}</span>
        {doc.status === "ready" && (
          <button onClick={onSummarize} className="text-slate-500 hover:text-violet-400 p-1.5" title="AI Summary">
            <Sparkles size={14} />
          </button>
        )}
        <button onClick={onStartRename} className="text-slate-500 hover:text-slate-200 p-1.5"><Pencil size={14} /></button>
        <button onClick={onDelete} className="text-slate-500 hover:text-coral-400 p-1.5"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
