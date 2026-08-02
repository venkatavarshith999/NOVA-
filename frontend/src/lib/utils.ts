import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const ENTITY_COLORS: Record<string, string> = {
  Organization: "#8b5cf6",
  Department: "#3b82f6",
  Country: "#22d3ee",
  Person: "#fb7185",
  Policy: "#a78bfa",
  Regulation: "#fbbf24",
  Standard: "#34d399",
  Product: "#f472b6",
  "Storage Location": "#60a5fa",
  "Security Control": "#f87171",
  Encryption: "#facc15",
  "Retention Period": "#2dd4bf",
  "Compliance Rule": "#c084fc",
  Entity: "#94a3b8",
};

export function entityColor(type: string): string {
  return ENTITY_COLORS[type] ?? "#94a3b8";
}
