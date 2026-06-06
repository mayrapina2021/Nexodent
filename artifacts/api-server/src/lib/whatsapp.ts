import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import { db, conversationsTable, messagesTable, settingsTable } from "@workspace/db";
import { eq, sql, or, and, desc } from "drizzle-orm";
import { generateAIResponse } from "./groq";
import { processAISendDocuments } from "./ai-send-documents";
import { synthesizeAudio } from "./tts";
import { logger } from "./logger";
import { usePostgresAuthState } from "./postgres-auth-state";
import { getAvailableSlots } from "./appointment-slots";
import { processAIActions } from "./ai-actions";
import { amendAiMessageIfBookingFailed } from "./booking-message";
import { parseIncomingContact, resolveOutboundJid, phoneToJidIfValid } from "./jid-utils";
import { resolveConversationIdentity, isValidColombianPhone } from "./conversation-patient-sync";
import { parseWhatsAppMessage } from "./whatsapp-message-parser";
import { waDebug } from "./wa-debug";

export interface WAState {
  connected: boolean;
  phone: string | null;
  connectedAt: Date | null;
  status: "connected" | "disconnected" | "connecting" | "waiting_qr";
  qrDataUrl: string | null;
  botEnabled: boolean;
}

const _messageStore = new Map<string, proto.IMessage>();

function messageStoreKey(key: proto.IMessageKey | null | undefined): string | null {
  if (!key?.remoteJid || !key.id) return null;
  return `${key.remoteJid}:${key.id}`;
}

function cacheMessage(msg: proto.IWebMessageInfo): void {
  const k = messageStoreKey(msg.key);
  if (!k || !msg.message) return;
  _messageStore.set(k, msg.message);
  if (_messageStore.size > 800) {
    const first = _messageStore.keys().next().value;
    if (first) _messageStore.delete(first);
  }
}

const _processedMsgIds = new Set<string>();

function markProcessed(msgId: string): void {
  _processedMsgIds.add(msgId);
  if (_processedMsgIds.size > 2000) {
    const first = _processedMsgIds.values().next().value;
    if (first) _processedMsgIds.delete(first);
  }
}

function wasProcessedInMemory(msgId: string): boolean {
  return _processedMsgIds.has(msgId);
}

let sock: WASocket | null = null;
let startPromise: Promise<void> | null = null;
let _state: WAState = {
  connected: false,
  phone: null,
  connectedAt: null,
  status: "disconnected",
  qrDataUrl: null,
  botEnabled: true,
};

export const getWhatsAppSock = () => sock;
export const getWhatsAppStatus = () => _state.status;

export function getWAState(): WAState {
  return { ..._state };
}

export async function syncBotEnabled(enabled?: boolean): Promise<boolean> {
  try {
    if (typeof enabled === "boolean") {
      await db.update(settingsTable).set({ aiBotEnabled: enabled });
      _state.botEnabled = enabled;
      return enabled;
    }
    const [settings] = await db.select().from(settingsTable).limit(1);
    if (settings && typeof settings.aiBotEnabled === "boolean") {
      _state.botEnabled = settings.aiBotEnabled;
      return settings.aiBotEnabled;
    }
  } catch (err) {
    logger.error({ err }, "Error sincronizando botEnabled con DB");
  }
  return _state.botEnabled;
}

export function getBotEnabled(): boolean {
  return _state.botEnabled;
}

export async function setBotEnabled(enabled: boolean): Promise<void> {
  await syncBotEnabled(enabled);
  logger.info({ botEnabled: enabled }, "Bot IA global actualizado y persistido");
}

export function phoneToJid(phone: string): string {
  const jid = phoneToJidIfValid(phone);
  if (jid) return jid;
  const clean = phone.replace(/\D/g, "");
  const finalPhone = clean.length === 10 && clean.startsWith("3") ? `57${clean}` : clean;
  return `${finalPhone}@s.whatsapp.net`;
}

export async function sendWAMessage(jid: string, text: string): Promise<boolean> {
  if (!sock || !_state.connected) return false;
  if (!jid?.includes("@")) return false;
  try {
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    logger.error({ err, jid }, "Error enviando mensaje WhatsApp");
    return false;
  }
}

export async function sendMessageToConversation(
  conv: { whatsappJid?: string | null; phone: string },
  text: string,
  patientPhone?: string | null,
): Promise<boolean> {
  const jid = resolveOutboundJid(conv, patientPhone);
  if (!jid) {
    logger.warn({ phone: conv.phone, whatsappJid: conv.whatsappJid }, "No se pudo resolver JID de WhatsApp");
    return false;
  }
  return sendWAMessage(jid, text);
}

export async function sendMessageToPhone(phone: string, text: string): Promise<boolean> {
  const jid = phoneToJidIfValid(phone);
  if (!jid) return false;
  return sendWAMessage(jid, text);
}

async function teardownSocket(): Promise<void> {
  if (!sock) return;
  const old = sock;
  sock = null;
  try {
    old.ev.removeAllListeners("connection.update");
    old.ev.removeAllListeners("messages.upsert");
    old.ev.removeAllListeners("messages.update");
    old.ev.removeAllListeners("creds.update");
    await old.end(undefined);
  } catch (err) {
    logger.warn({ err }, "Error cerrando socket WhatsApp anterior");
  }
  waDebug("socket_teardown");
}

export async function disconnectWA(): Promise<void> {
  await teardownSocket();
  try {
    const { clearAuth } = await usePostgresAuthState();
    await clearAuth();
  } catch {}
  _state = {
    connected: false,
    phone: null,
    connectedAt: null,
    status: "disconnected",
    qrDataUrl: null,
    botEnabled: _state.botEnabled,
  };
  waDebug("disconnected_manual");
}

async function findMessageByWhatsappId(whatsappMsgId: string) {
  const [row] = await db.select().from(messagesTable)
    .where(eq(messagesTable.whatsappMsgId, whatsappMsgId))
    .limit(1);
  return row ?? null;
}

async function findRecentDuplicateMessage(
  conversationId: number,
  sender: "agent" | "ai",
  content: string,
  withinMs = 120_000,
) {
  const cutoff = new Date(Date.now() - withinMs);
  const recent = await db.select().from(messagesTable)
    .where(and(
      eq(messagesTable.conversationId, conversationId),
      eq(messagesTable.sender, sender),
    ))
    .orderBy(desc(messagesTable.sentAt))
    .limit(8);

  const normalized = content.trim();
  return recent.find((m) => m.content.trim() === normalized && m.sentAt >= cutoff) ?? null;
}

async function resolveOrCreateConversation(
  whatsappJid: string,
  formattedPhone: string,
  phone: string,
  pushName: string,
) {
  const identity = await resolveConversationIdentity(formattedPhone, pushName);

  const allConvs = await db.select().from(conversationsTable)
    .where(or(
      eq(conversationsTable.whatsappJid, whatsappJid),
      eq(conversationsTable.phone, identity.phone),
      eq(conversationsTable.phone, formattedPhone),
      eq(conversationsTable.phone, phone),
    ))
    .orderBy(sql`${conversationsTable.lastMessageAt} desc nulls last`);

  let conv;
  if (allConvs.length === 0) {
    [conv] = await db.insert(conversationsTable).values({
      patientId: identity.patientId,
      patientName: identity.patientName,
      phone: identity.phoneIsValid ? identity.phone : formattedPhone,
      whatsappJid,
      status: "active",
      aiMode: true,
      label: "patient",
      unreadCount: 0,
      lastMessage: null,
      lastMessageAt: new Date(),
    }).returning();
  } else {
    [conv] = allConvs;
    if (allConvs.length > 1) {
      logger.warn({ phone: formattedPhone, count: allConvs.length }, "Fusionando conversaciones duplicadas...");
      const toRemove = allConvs.slice(1);
      for (const rem of toRemove) {
        await db.update(messagesTable).set({ conversationId: conv.id }).where(eq(messagesTable.conversationId, rem.id));
        await db.delete(conversationsTable).where(eq(conversationsTable.id, rem.id));
      }
    }
  }

  const refreshedIdentity = await resolveConversationIdentity(
    isValidColombianPhone(formattedPhone) ? formattedPhone : conv.phone,
    pushName,
    conv.patientId ?? identity.patientId,
  );

  return {
    ...conv,
    whatsappJid,
    patientId: refreshedIdentity.patientId,
    patientName: refreshedIdentity.patientName,
    phone: refreshedIdentity.phoneIsValid ? refreshedIdentity.phone : conv.phone,
  };
}

async function handleIncomingMessage(
  msg: proto.IWebMessageInfo,
  source: string = "notify",
): Promise<void> {
  if (!msg.key) return;

  cacheMessage(msg);

  const jid = msg.key.remoteJid ?? "";
  if (!jid || jid.includes("@g.us") || jid === "status@broadcast") return;

  const fromMe = msg.key.fromMe === true;
  const msgId = msg.key.id ?? "";

  if (msgId && wasProcessedInMemory(msgId)) return;

  if (msgId) {
    const existing = await findMessageByWhatsappId(msgId);
    if (existing) {
      markProcessed(msgId);
      return;
    }
  }

  if (!msg.message) {
    waDebug("message_pending_decrypt", { msgId, source, jid, fromMe });
    return;
  }

  const contact = parseIncomingContact(msg);
  if (!contact) {
    waDebug("contact_parse_failed", { msgId, jid });
    return;
  }

  const { whatsappJid, phone: formattedPhone } = contact;
  const phone = formattedPhone.replace(/^\+/, "");
  const pushName = msg.pushName ?? formattedPhone;

  const globalBotEnabled = await syncBotEnabled();
  const [existingConv] = await db.select().from(conversationsTable)
    .where(or(
      eq(conversationsTable.phone, formattedPhone),
      eq(conversationsTable.phone, phone),
      eq(conversationsTable.whatsappJid, whatsappJid),
    ))
    .orderBy(sql`${conversationsTable.lastMessageAt} desc nulls last`);

  const shouldTranscribeAudio = !fromMe && globalBotEnabled && (!existingConv || existingConv.aiMode);

  const parsed = await parseWhatsAppMessage(msg, sock, { transcribeAudio: shouldTranscribeAudio });
  if (!parsed?.text.trim() && !parsed?.mediaData) {
    waDebug("message_unparseable", { msgId, source, jid, phone: formattedPhone });
    return;
  }

  const text = parsed.text.trim() || (parsed.mediaData ? parsed.text : "");
  if (!text && !parsed.mediaData) return;

  waDebug("message_received", { msgId, source, jid, phone: formattedPhone, fromMe, preview: text.slice(0, 80) });
  logger.info({ jid, fromMe, text, messageType: parsed.messageType, source }, "Mensaje de WhatsApp recibido");

  try {
    let conv = await resolveOrCreateConversation(whatsappJid, formattedPhone, phone, pushName);

    if (fromMe) {
      const dupAgent = await findRecentDuplicateMessage(conv.id, "agent", text);
      if (dupAgent) {
        if (msgId) {
          await db.update(messagesTable).set({ whatsappMsgId: msgId }).where(eq(messagesTable.id, dupAgent.id));
        }
        return;
      }
      const dupAi = await findRecentDuplicateMessage(conv.id, "ai", text);
      if (dupAi) {
        if (msgId) {
          await db.update(messagesTable).set({ whatsappMsgId: msgId }).where(eq(messagesTable.id, dupAi.id));
        }
        return;
      }
    }

    const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;

    await db.insert(messagesTable).values({
      conversationId: conv.id,
      content: text,
      sender: fromMe ? "agent" : "patient",
      messageType: parsed.messageType,
      mediaMimeType: parsed.mediaMimeType ?? null,
      mediaData: parsed.mediaData ?? null,
      whatsappMsgId: msgId || null,
      read: fromMe,
    });

    if (msgId) markProcessed(msgId);

    waDebug("message_saved", { msgId, conversationId: conv.id, phone: formattedPhone });
    logger.info({ msgId, source, conversationId: conv.id, phone: formattedPhone, text: preview }, "Mensaje guardado en CRM");

    await db.update(conversationsTable).set({
      lastMessage: preview,
      lastMessageAt: new Date(),
      unreadCount: fromMe ? conv.unreadCount : sql`${conversationsTable.unreadCount} + 1`,
      whatsappJid,
      patientId: conv.patientId,
      patientName: conv.patientName,
      phone: conv.phone,
    }).where(eq(conversationsTable.id, conv.id));

    if (fromMe) return;

    const [latestConv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conv.id));
    const aiEnabled = latestConv?.aiMode === true && globalBotEnabled === true;

    if (!aiEnabled) return;

    let aiText = "";
    try {
      const availableSlots = await getAvailableSlots();
      const aiResult = await generateAIResponse(conv.id, text, {
        availableSlots,
        contactPhone: isValidColombianPhone(formattedPhone) ? formattedPhone : undefined,
      });

      try {
        const { conversation: updatedConv, bookingOutcome } = await processAIActions(
          {
            id: conv.id,
            patientId: conv.patientId,
            patientName: conv.patientName,
            phone: formattedPhone,
          },
          isValidColombianPhone(formattedPhone) ? formattedPhone : conv.phone,
          aiResult.actions,
          "whatsapp",
          { patientMessage: text },
        );
        conv = { ...conv, ...updatedConv, patientName: updatedConv.patientName ?? conv.patientName };
        aiText = amendAiMessageIfBookingFailed(aiResult.message, bookingOutcome);

        const outboundJid = conv.whatsappJid ?? whatsappJid;
        if (outboundJid && (aiResult.actions.sendQuotation || aiResult.actions.sendPaymentReceipt || aiResult.actions.sendConsentLink)) {
          await processAISendDocuments(conv.patientId, formattedPhone, outboundJid, aiResult.actions);
        }
      } catch (actionErr) {
        logger.error({ actionErr, conversationId: conv.id }, "Error en acciones IA; se envía respuesta al paciente igual");
        aiText = aiResult.message;
      }

      if (!aiText?.trim()) {
        aiText = "Hola, gracias por escribirnos. ¿En qué puedo ayudarte hoy?";
      }
    } catch (err) {
      logger.error({ err, conversationId: conv.id }, "Error generando respuesta IA");
      aiText = "Hola, gracias por contactar a Nexodent. En un momento te damos la información. ¿En qué podemos ayudarte?";
    }

    if (aiText) {
      await db.insert(messagesTable).values({
        conversationId: conv.id,
        content: aiText,
        sender: "ai",
        messageType: "text",
        read: true,
      });

      await db.update(conversationsTable).set({
        lastMessage: aiText,
        lastMessageAt: new Date(),
      }).where(eq(conversationsTable.id, conv.id));

      const outboundJid = conv.whatsappJid ?? whatsappJid;
      if (sock && outboundJid) {
        try {
          if (parsed.wasAudio) {
            const audioResponse = await synthesizeAudio(aiText);
            await sock.sendMessage(outboundJid, {
              audio: audioResponse.buffer,
              mimetype: audioResponse.mimetype,
              ptt: true,
            });
          } else {
            await sock.sendMessage(outboundJid, { text: aiText });
          }
          waDebug("ai_reply_sent", { jid: outboundJid, conversationId: conv.id });
        } catch (wsErr) {
          logger.error({ wsErr, jid: outboundJid }, "Error al enviar mensaje a través de WhatsApp Socket");
          waDebug("ai_reply_failed", { jid: outboundJid, error: String(wsErr) });
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Error procesando mensaje entrante");
    waDebug("message_error", { error: String(err), msgId });
  }
}

async function startWhatsAppImpl(): Promise<void> {
  await teardownSocket();
  _state.status = "connecting";
  await syncBotEnabled();

  const { state: authState, saveCreds } = await usePostgresAuthState();
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    logger: logger.child({ module: "baileys" }) as any,
    browser: ["Nexodent", "Chrome", "120.0.0"],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 20000,
    retryRequestDelayMs: 1000,
    maxMsgRetryCount: 5,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    receivedPendingNotifications: true,
    emitOwnEvents: false,
    getMessage: async (key) => {
      const k = messageStoreKey(key);
      return k ? _messageStore.get(k) : undefined;
    },
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        _state.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        _state.status = "waiting_qr";
        waDebug("qr_generated");
        logger.info("QR de WhatsApp generado");
      } catch (err) {
        logger.error({ err }, "Error generando QR");
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const prevBotEnabled = _state.botEnabled;

      waDebug("connection_close", { statusCode, shouldReconnect });
      await teardownSocket();

      _state.connected = false;
      _state.qrDataUrl = null;
      _state.status = "disconnected";
      _state.botEnabled = prevBotEnabled;

      if (shouldReconnect) {
        logger.info({ statusCode }, "WhatsApp desconectado, reconectando...");
        setTimeout(() => { startWhatsApp().catch((err) => logger.error({ err }, "Error reconectando WA")); }, 4000);
      } else {
        logger.info("WhatsApp cerro sesion (loggedOut)");
        usePostgresAuthState().then(({ clearAuth }) => clearAuth()).catch(() => {});
        _state = { connected: false, phone: null, connectedAt: null, status: "disconnected", qrDataUrl: null, botEnabled: prevBotEnabled };
      }
    }

    if (connection === "open") {
      const phone = sock?.user?.id?.split(":")[0] ?? sock?.user?.id ?? "desconocido";
      const prevBotEnabled = _state.botEnabled;
      _state = {
        connected: true,
        phone: phone.startsWith("+") ? phone : `+${phone}`,
        connectedAt: new Date(),
        status: "connected",
        qrDataUrl: null,
        botEnabled: prevBotEnabled,
      };
      waDebug("connection_open", { phone: _state.phone });
      logger.info({ phone: _state.phone }, "WhatsApp conectado exitosamente");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    waDebug("upsert_batch", { type, count: messages.length });
    for (const msg of messages) {
      try {
        await handleIncomingMessage(msg, type ?? "notify");
      } catch (err) {
        logger.error({ err, type, msgId: msg.key?.id }, "Error en messages.upsert");
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const { key, update } of updates) {
      if (!key?.id) continue;
      const patch = update as { message?: proto.IMessage; messageTimestamp?: number; pushName?: string };
      if (!patch.message) continue;
      if (wasProcessedInMemory(key.id)) continue;
      const existing = await findMessageByWhatsappId(key.id);
      if (existing) {
        markProcessed(key.id);
        continue;
      }
      try {
        const fullMsg: proto.IWebMessageInfo = {
          key,
          message: patch.message,
          messageTimestamp: patch.messageTimestamp,
          pushName: patch.pushName,
        };
        await handleIncomingMessage(fullMsg, "update");
      } catch (err) {
        logger.error({ err, msgId: key.id }, "Error en messages.update");
      }
    }
  });
}

export async function startWhatsApp(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = startWhatsAppImpl().finally(() => {
    startPromise = null;
  });
  return startPromise;
}
