import Layout from "@/components/layout";
import {
  useListConversations,
  useGetConversation,
  useSendMessage,
  useSetConversationMode,
  useDeleteConversation,
  getListConversationsQueryKey,
  getGetConversationQueryKey,
  getGetMessagesQueryKey,
} from "@workspace/api-client-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Search, Send, Bot, User, Phone, Trash2, ImageIcon, Mic, Video, FileText, Sticker } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatMessageDateTime } from "@/lib/datetime";
import { ChatMedia, mediaTypeLabel, previewFromMessage } from "@/components/chat-media";

type ChatMessage = {
  id: number;
  conversationId?: number;
  content: string;
  sender: string;
  messageType?: string | null;
  mediaMimeType?: string | null;
  hasMedia?: boolean;
  sentAt: string;
  read?: boolean;
};

function MediaTypeBadge({ type }: { type: string }) {
  const icons: Record<string, typeof ImageIcon> = {
    image: ImageIcon,
    sticker: Sticker,
    video: Video,
    audio: Mic,
    document: FileText,
  };
  const Icon = icons[type];
  if (!Icon) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
      <Icon className="h-3 w-3" />
      {mediaTypeLabel(type).replace(/^[^\s]+\s/, "")}
    </span>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isPatient = msg.sender === "patient";
  const isAi = msg.sender === "ai";
  const type = msg.messageType ?? "text";
  const isMedia = type !== "text" && (msg.hasMedia || type !== "text");
  const showMedia = msg.hasMedia && msg.id > 0;

  return (
    <div className={cn("flex", isPatient ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 text-sm space-y-2",
          isPatient
            ? "bg-card border border-border/50 text-foreground rounded-tl-sm"
            : isAi
              ? "bg-accent/20 border border-accent/30 text-foreground rounded-tr-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm",
        )}
      >
        {isAi && (
          <div className="flex items-center gap-1">
            <Bot className="h-3 w-3 text-accent" />
            <span className="text-xs text-accent font-medium">Asistente IA</span>
          </div>
        )}
        {msg.sender === "agent" && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-primary-foreground/70" />
            <span className="text-xs text-primary-foreground/70 font-medium">Agente</span>
          </div>
        )}

        {isMedia && <MediaTypeBadge type={type} />}

        {showMedia && (
          <ChatMedia
            messageId={msg.id}
            messageType={type}
            mimeType={msg.mediaMimeType}
            alt={msg.content}
          />
        )}

        {showMedia && type === "document" && (
          <p className="text-xs font-medium truncate">{msg.content}</p>
        )}

        {type === "audio" && msg.content && (
          <p className="text-xs italic opacity-90 whitespace-pre-wrap break-words">
            {msg.content.startsWith("🎤") ? msg.content : `"${msg.content}"`}
          </p>
        )}

        {(type === "text" || type === "image" || type === "sticker" || type === "video") &&
          msg.content &&
          !(type === "image" && msg.content === "📷 Imagen") &&
          !(type === "sticker" && msg.content === "🎭 Sticker") &&
          !(type === "video" && msg.content === "🎬 Video") &&
          type !== "audio" &&
          type !== "document" && (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          )}

        {!showMedia && isMedia && (
          <p className="text-xs opacity-80">{msg.content || mediaTypeLabel(type)}</p>
        )}

        <p
          className={cn(
            "text-xs",
            isPatient ? "text-muted-foreground" : isAi ? "text-muted-foreground" : "text-primary-foreground/70",
          )}
        >
          {formatMessageDateTime(msg.sentAt)}
        </p>
      </div>
    </div>
  );
}

export default function Conversations() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const params = { search: search || undefined };
  const { data: conversations, isLoading } = useListConversations(params, {
    query: {
      queryKey: getListConversationsQueryKey(params),
      refetchInterval: 1000,
      refetchIntervalInBackground: true,
    },
  });
  const { data: detail, isLoading: detailLoading } = useGetConversation(selectedId!, {
    query: {
      enabled: !!selectedId,
      queryKey: getGetConversationQueryKey(selectedId!),
      refetchInterval: 800,
      refetchIntervalInBackground: true,
    },
  });

  useEffect(() => {
    if (conversations || detail) {
      setLastSynced(new Date());
    }
  }, [conversations, detail]);

  const sendMessage = useSendMessage();
  const setMode = useSetConversationMode();
  const deleteConversation = useDeleteConversation();

  const handleDeleteConversation = (id: number) => {
    deleteConversation.mutate(
      { id },
      {
        onSuccess: () => {
          if (selectedId === id) setSelectedId(null);
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          toast({ title: "Conversación eliminada" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "No se pudo eliminar la conversación" });
        },
      },
    );
  };

  const handleSend = () => {
    if (!message.trim() || !selectedId) return;
    const content = message.trim();
    setMessage("");

    sendMessage.mutate(
      { conversationId: selectedId, data: { content } },
      {
        onMutate: async () => {
          await queryClient.cancelQueries({ queryKey: getGetConversationQueryKey(selectedId) });
          const previous = queryClient.getQueryData(getGetConversationQueryKey(selectedId));
          queryClient.setQueryData(getGetConversationQueryKey(selectedId), (old: typeof detail) => {
            if (!old) return old;
            const optimistic: ChatMessage = {
              id: -Date.now(),
              conversationId: selectedId,
              content,
              sender: "agent",
              messageType: "text",
              sentAt: new Date().toISOString(),
              read: true,
            };
            return { ...old, messages: [...(old.messages ?? []), optimistic] };
          });
          return { previous };
        },
        onError: (_err, _vars, context: { previous?: unknown } | undefined) => {
          if (context?.previous) {
            queryClient.setQueryData(getGetConversationQueryKey(selectedId), context.previous);
          }
          setMessage(content);
          toast({ variant: "destructive", title: "No se pudo enviar el mensaje" });
        },
        onSuccess: (res) => {
          const sendResult = res as { sentToWhatsApp?: boolean; whatsappError?: string | null };
          queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(selectedId) });
          queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(selectedId) });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          if (sendResult?.sentToWhatsApp === false) {
            toast({
              variant: "destructive",
              title: "No llegó a WhatsApp",
              description:
                sendResult.whatsappError ??
                "El mensaje quedó guardado en el CRM pero no se envió al teléfono. Pide al contacto que escriba de nuevo al WhatsApp de la clínica.",
            });
          }
        },
      } as Parameters<typeof sendMessage.mutate>[1],
    );
  };

  const toggleAI = (id: number, aiMode: boolean) => {
    setMode.mutate(
      { id, data: { aiMode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) });
        },
      },
    );
  };

  const selected = detail?.conversation;
  const messages = (detail?.messages ?? []) as ChatMessage[];
  const patient = detail?.patient;

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedId, scrollToBottom]);

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex gap-0 rounded-xl overflow-hidden border border-border/50">
        <div className="w-80 flex-shrink-0 bg-card/80 border-r border-border/50 flex flex-col">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Chat Center</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                En vivo {lastSynced.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-9 bg-background border-border h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !conversations?.length ? (
              <div className="text-center py-12 text-muted-foreground text-sm px-4">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Sin conversaciones aún.</p>
                <p className="mt-1 text-xs">Los mensajes de WhatsApp aparecerán aquí.</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-background/50 transition-colors border-b border-border/30 group",
                    selectedId === conv.id && "bg-background/70 border-l-2 border-l-accent",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {conv.patientName.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {(conv as { displayName?: string }).displayName ?? conv.patientName}
                        </p>
                        <p className="text-xs text-foreground/70 truncate">
                          {previewFromMessage(conv.lastMessage)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground text-right leading-tight max-w-[9rem]">
                        {formatMessageDateTime(conv.lastMessageAt)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-accent text-accent-foreground text-xs px-1.5 py-0 min-w-5 h-5 flex items-center justify-center">
                          {conv.unreadCount}
                        </Badge>
                      )}
                      {conv.aiMode && <Bot className="h-3 w-3 text-accent" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center bg-background/30">
            <div className="text-center text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Selecciona una conversación para ver los mensajes</p>
              <p className="text-xs mt-2 max-w-sm mx-auto">
                Texto, imágenes, audios, videos, documentos y stickers de WhatsApp.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-background/20">
            <div className="px-6 py-4 border-b border-border/50 bg-card/50 flex items-center justify-between gap-3">
              {detailLoading && !selected ? (
                <Skeleton className="h-8 w-48" />
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {selected?.patientName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {(selected as { displayName?: string })?.displayName ?? selected?.patientName}
                        {patient && (
                          <span className="text-xs font-normal text-muted-foreground ml-2">
                            · Paciente #{patient.id}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(selected as { displayPhone?: string })?.displayPhone ?? selected?.phone}
                        {(selected as { phoneIsValid?: boolean })?.phoneIsValid === false && (
                          <span className="text-amber-500 ml-2">· Número WA pendiente de vincular</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        checked={selected?.aiMode ?? true}
                        onCheckedChange={(v) => toggleAI(selected!.id, v)}
                      />
                      <Label className="text-xs text-muted-foreground hidden sm:inline">
                        {selected?.aiMode ? "IA Activa" : "Manual"}
                      </Label>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                          title="Eliminar conversación"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar esta conversación?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se borrarán todos los mensajes de este chat del panel. El paciente en WhatsApp no se elimina;
                            si escribe de nuevo, se creará una conversación nueva.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteConversation(selected!.id)}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {detailLoading && !messages.length ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className={`h-12 w-2/3 ${i % 2 === 0 ? "" : "ml-auto"}`} />
                  ))}
                </div>
              ) : !messages.length ? (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  Sin mensajes en esta conversación
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
            </div>

            <div className="p-4 border-t border-border/50 bg-card/50 flex gap-3">
              <Input
                placeholder="Escribe un mensaje como agente..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                className="bg-background border-border"
              />
              <Button
                onClick={handleSend}
                disabled={sendMessage.isPending || !message.trim()}
                className="bg-primary px-4"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
