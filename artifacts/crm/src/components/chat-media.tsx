import { useEffect, useState } from "react";
import { Loader2, ImageOff } from "lucide-react";
import { getAuthToken } from "@/lib/auth-token";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://nexodent-api.onrender.com";

type ChatMediaProps = {
  messageId: number;
  messageType: string;
  mimeType?: string | null;
  alt?: string;
  className?: string;
};

export function ChatMedia({ messageId, messageType, mimeType, alt, className }: ChatMediaProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!messageId || messageId <= 0) {
      setFailed(true);
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/api/messages/media/${messageId}`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("media fetch failed");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center rounded-lg bg-muted/40 p-6", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (failed || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-dashed border-border/50 px-3 py-2 text-xs text-muted-foreground", className)}>
        <ImageOff className="h-4 w-4 shrink-0" />
        <span>{alt ?? "Archivo no disponible"}</span>
      </div>
    );
  }

  if (messageType === "video") {
    return (
      <video
        src={blobUrl}
        controls
        className={cn("rounded-lg max-h-72 w-full border border-border/30", className)}
        preload="metadata"
      />
    );
  }

  if (messageType === "audio") {
    return <audio src={blobUrl} controls className={cn("w-full max-w-full", className)} preload="metadata" />;
  }

  if (messageType === "document") {
    const isPdf = mimeType?.includes("pdf");
    if (isPdf) {
      return (
        <iframe
          src={blobUrl}
          title={alt ?? "Documento"}
          className={cn("rounded-lg w-full h-64 border border-border/30 bg-background", className)}
        />
      );
    }
    return (
      <a
        href={blobUrl}
        download={alt ?? "archivo"}
        className={cn("text-xs underline underline-offset-2", className)}
      >
        Descargar archivo
      </a>
    );
  }

  return (
    <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={blobUrl}
        alt={alt ?? "Imagen"}
        className={cn("rounded-lg max-h-72 w-full object-cover border border-border/30", className)}
      />
    </a>
  );
}

export function mediaTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "image": return "📷 Imagen";
    case "sticker": return "🎭 Sticker";
    case "video": return "🎬 Video";
    case "audio": return "🎤 Audio";
    case "document": return "📎 Documento";
    default: return "";
  }
}

export function previewFromMessage(content: string | null | undefined, messageType?: string | null): string {
  if (!content?.trim()) {
    const label = mediaTypeLabel(messageType);
    return label || "Sin mensajes";
  }
  return content;
}
