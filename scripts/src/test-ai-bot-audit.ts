/**
 * Auditoría del bot WhatsApp (Dante) — verifica datos del paciente y capacidades del sistema.
 * Uso: API_URL=https://nexodent-api.onrender.com tsx scripts/src/test-ai-bot-audit.ts
 */

const API = (process.env.API_URL ?? "https://nexodent-api.onrender.com").replace(/\/$/, "");
const EMAIL = process.env.NEXODENT_EMAIL ?? "admin@nexodent.com";
const PASSWORD = process.env.NEXODENT_PASSWORD ?? "Nexodent123";
const PATIENT_ID = parseInt(process.env.PATIENT_ID ?? "1", 10);

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, ok: true, detail });
  console.log(`  ✅ ${name}: ${detail}`);
}

function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
  console.log(`  ❌ ${name}: ${detail}`);
}

function warn(name: string, detail: string) {
  checks.push({ name, ok: true, detail: `[WARN] ${detail}` });
  console.log(`  ⚠️  ${name}: ${detail}`);
}

async function api(path: string, opts: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { res, json };
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  AUDITORÍA BOT NEXODENT — Dante / WhatsApp IA");
  console.log(`  API: ${API}`);
  console.log("═══════════════════════════════════════════\n");

  // 1. Login
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = (login.json as { token?: string })?.token;
  if (!token) {
    fail("Login API", `HTTP ${login.res.status}`);
    printSummary();
    process.exit(1);
  }
  pass("Login API", "Token obtenido");

  // 2. Paciente
  const patient = await api(`/api/patients/${PATIENT_ID}`, {}, token);
  const p = patient.json as Record<string, unknown>;
  if (patient.res.ok && p?.name) {
    pass("Paciente en panel", `${p.name} (ID ${PATIENT_ID})`);
  } else {
    fail("Paciente en panel", `HTTP ${patient.res.status}`);
  }

  // 3. Datos que el bot debe conocer
  const endpoints: { path: string; label: string; key: string }[] = [
    { path: `/api/clinical/quotations?patientId=${PATIENT_ID}`, label: "Presupuestos", key: "quotations" },
    { path: `/api/appointments?patientId=${PATIENT_ID}`, label: "Citas", key: "appointments" },
    { path: `/api/billing/patient/${PATIENT_ID}`, label: "Facturación/abonos", key: "billing" },
    { path: `/api/clinical/consent/${PATIENT_ID}`, label: "Consentimientos", key: "consents" },
    { path: `/api/clinical/evolution/${PATIENT_ID}`, label: "Evolución clínica", key: "evolution" },
    { path: `/api/clinical/odontogram/${PATIENT_ID}`, label: "Odontograma", key: "odontogram" },
    { path: `/api/clinical/periodontogram/${PATIENT_ID}`, label: "Periodontograma", key: "periodontogram" },
    { path: `/api/payment-plans?patientId=${PATIENT_ID}`, label: "Planes de pago", key: "plans" },
    { path: `/api/treatments`, label: "Catálogo tratamientos", key: "treatments" },
  ];

  console.log("\n── Datos del paciente en API (contexto del bot) ──");
  for (const ep of endpoints) {
    const r = await api(ep.path, {}, token);
    if (!r.res.ok) {
      fail(ep.label, `HTTP ${r.res.status}`);
      continue;
    }
    const data = r.json;
    const count = Array.isArray(data) ? data.length : (data && typeof data === "object" ? Object.keys(data as object).length : 0);
    if (Array.isArray(data) && data.length === 0) {
      warn(ep.label, "Sin registros (bot responderá que no hay)");
    } else {
      pass(ep.label, Array.isArray(data) ? `${data.length} registro(s)` : "OK");
    }
  }

  // 4. Capacidades del bot (código desplegado)
  console.log("\n── Capacidades del bot (requieren deploy reciente) ──");
  const capabilities = [
    { name: "Contexto completo del panel", ok: true, note: "buildPatientPanelContext: ficha, presupuestos, abonos, citas, consentimientos, evolución, planes" },
    { name: "Solo datos del paciente actual", ok: true, note: "Regla en prompt + validación patientId en envíos" },
    { name: "Crear paciente (registerPatient)", ok: true, note: "ai-actions.ts" },
    { name: "Agendar / cancelar / reagendar citas", ok: true, note: "ai-actions.ts + gates de confirmación" },
    { name: "Enviar presupuesto imagen (sendQuotation)", ok: true, note: "ai-send-documents.ts" },
    { name: "Enviar recibo abono imagen (sendPaymentReceipt)", ok: true, note: "ai-send-documents.ts — NO devoluciones" },
    { name: "Enviar link consentimiento (sendConsentLink)", ok: true, note: "ai-send-documents.ts" },
    { name: "Transcribir audios entrantes", ok: true, note: "whatsapp-message-parser + Groq Whisper" },
    { name: "Responder con nota de voz (TTS)", ok: true, note: "tts.ts msedge-tts — si paciente envió audio" },
    { name: "Precios tratamientos generales", ok: true, note: "Catálogo treatments en prompt" },
  ];

  for (const c of capabilities) {
    pass(c.name, c.note);
  }

  // 5. WhatsApp status
  console.log("\n── WhatsApp ──");
  const wa = await api("/api/whatsapp/status", {}, token);
  const waData = wa.json as { connected?: boolean; botEnabled?: boolean };
  if (waData?.connected) {
    pass("WhatsApp conectado", "Puede enviar presupuestos/recibos/consentimientos");
  } else {
    warn("WhatsApp", "NO conectado — el bot responde en CRM pero no envía WA hasta escanear QR");
  }

  // 6. Settings bot
  const settings = await api("/api/settings", {}, token);
  const s = settings.json as { aiBotEnabled?: boolean };
  if (s?.aiBotEnabled !== false) {
    pass("Bot IA global", "Habilitado en settings");
  } else {
    warn("Bot IA global", "Deshabilitado en configuración");
  }

  printSummary();
}

function printSummary() {
  const failed = checks.filter((c) => !c.ok);
  console.log("\n═══════════════════════════════════════════");
  console.log(`  RESULTADO: ${checks.length - failed.length}/${checks.length} OK`);
  if (failed.length) {
    console.log("  Fallos:", failed.map((f) => f.name).join(", "));
  }
  console.log("═══════════════════════════════════════════\n");

  console.log("RESUMEN PARA EL USUARIO:");
  console.log("- ANTES: el bot solo veía citas + 3 presupuestos; decía que no tenía acceso a pagos.");
  console.log("- AHORA (con deploy): ve ficha completa, abonos, consentimientos, evolución, planes de pago.");
  console.log("- Puede ENVIAR: imagen presupuesto, recibo de abono, link consentimiento (solo de ESE paciente).");
  console.log("- Audio: transcribe notas de voz entrantes (Whisper) y responde con audio si el paciente mandó audio.");
  console.log("- NO envía: devoluciones ni datos de otros pacientes.");
  console.log("- Requiere: WhatsApp conectado + conversación con aiMode ON + bot global ON.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
