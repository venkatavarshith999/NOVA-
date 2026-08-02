import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_BASE } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function useProcessingSocket() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(`${WS_BASE}/api/ws/status?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "processing_status") {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            if (msg.status === "ready") {
              queryClient.invalidateQueries({ queryKey: ["analytics"] });
              queryClient.invalidateQueries({ queryKey: ["graph"] });
            }
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (!cancelled) setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [token, queryClient]);
}
