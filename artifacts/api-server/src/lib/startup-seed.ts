import { db, usersTable, aiKnowledgeTable, aiPersonalityTable, appointmentsTable, patientsTable, settingsTable, treatmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { ensureTreatmentsCatalog } from "./treatments-catalog";

const KNOWLEDGE = [
  {
    title: "Informacion general del consultorio",
    category: "general",
    content: `Clinica: Nexodent
Especialidad: Odontologia estetica, rehabilitacion oral e implantes
Horario: Lunes a Sabado de 8:00 a.m. a 6:00 p.m.
Ubicacion: Colombia
Politica de citas: Puntualidad requerida. Cancelaciones con minimo 24 horas de anticipacion.
Formas de pago: Efectivo, transferencia bancaria, tarjetas debito y credito. Planes de pago disponibles.`,
  },
  {
    title: "Pagos y politica de citas",
    category: "general",
    content: `PAGOS Y FINANCIACION:
- Efectivo, transferencias, tarjetas debito/credito
- Planes de pago para tratamientos mayores (implantes, ortodoncia, rehabilitacion)
- Pago por cuotas segun acuerdo
- Se expiden recibos para reembolso de seguros

POLITICA DE CITAS:
- Espera maxima 10 minutos
- Cancelar con 24h de anticipacion para no perder cupo
- Urgencias odontologicas segun disponibilidad del dia`,
  },
  {
    title: "Odontologia General - Precios",
    category: "tarifario",
    content: `ODONTOLOGIA GENERAL:
- Consulta de valoracion / diagnostico: $50.000 - $80.000
- Profilaxis (limpieza dental): $80.000 - $120.000
- Aplicacion de fluor: $30.000 - $50.000
- Sellantes: $40.000 - $60.000 por diente
- Resina (obturacion): $120.000 - $200.000 por diente
- Detartraje (raspado de sarro): $150.000 - $250.000
- Urgencia odontologica: $80.000 - $150.000
- Radiografia periapical: $30.000 - $50.000
- Radiografia panoramica: $80.000 - $120.000`,
  },
  {
    title: "Blanqueamiento Dental - Precios",
    category: "tarifario",
    content: `BLANQUEAMIENTO DENTAL:
- Blanqueamiento en consultorio (1 sesion): $350.000 - $500.000
- Blanqueamiento en casa (cubetas): $250.000 - $350.000
- Plan combinado (consultorio + casa): $500.000 - $700.000
- Resultado esperado: 4-8 tonos mas claro
- Duracion: 1-3 anos segun cuidados`,
  },
  {
    title: "Estetica Dental - Carillas y Diseno de Sonrisa",
    category: "tarifario",
    content: `ESTETICA DENTAL:
- Carillas de ceromero (resina estetica): $350.000 - $500.000 por diente
- Carillas de porcelana / disilicato de litio: $700.000 - $1.200.000 por diente
- Carillas de Zirconio: $800.000 - $1.300.000 por diente
- Diseno de sonrisa (plan completo): desde $3.000.000
- Microdiseno (ajuste de forma): $150.000 - $300.000 por diente
- Contorneado gingival (encias): $200.000 - $400.000
- Cierre de diastemas: $300.000 - $600.000`,
  },
  {
    title: "Rehabilitacion Oral - Coronas",
    category: "tarifario",
    content: `REHABILITACION ORAL:
- Corona porcelana fused to metal (PFM): $600.000 - $900.000
- Corona de Zirconio (full ceramic): $900.000 - $1.400.000
- Corona de disilicato de litio (e.max): $1.000.000 - $1.500.000
- Incrustacion (inlay/onlay) resina: $350.000 - $500.000
- Incrustacion porcelana/zirconio: $600.000 - $900.000
- Nucleo (fibra de vidrio): $200.000 - $350.000
- Puente 3 unidades porcelana: $1.800.000 - $2.700.000
- Puente 3 unidades zirconio: $2.700.000 - $4.200.000
- Corona provisional: $150.000 - $250.000`,
  },
  {
    title: "Protesis Dentales - Precios",
    category: "tarifario",
    content: `PROTESIS DENTALES:
- Protesis parcial removible (Acker): $800.000 - $1.300.000
- Protesis total (dentadura completa): $1.200.000 - $2.000.000
- Protesis flexible (sin metal): $1.000.000 - $1.600.000
- Rebase de protesis: $200.000 - $350.000
- Reparacion de protesis: $150.000 - $250.000`,
  },
  {
    title: "Implantes Dentales - Precios",
    category: "tarifario",
    content: `IMPLANTES DENTALES:
- Implante titanio (incluye corona): $3.500.000 - $5.000.000 por unidad
- Implante + corona zirconio premium: $5.000.000 - $7.000.000
- Pilar protetico: $500.000 - $900.000
- Injerto oseo (regeneracion): $1.500.000 - $2.500.000
- Elevacion de seno maxilar: $2.000.000 - $3.500.000
- Protocolo All-on-4: desde $18.000.000
- Tiempo de oseointergracion: 3-6 meses`,
  },
  {
    title: "Cirugia Oral - Precios",
    category: "tarifario",
    content: `CIRUGIA ORAL:
- Extraccion simple: $150.000 - $250.000
- Extraccion compleja / raiz retenida: $250.000 - $400.000
- Extraccion muela del juicio erupcionada: $250.000 - $400.000
- Extraccion muela del juicio impactada: $450.000 - $800.000
- Frenilectomia: $300.000 - $500.000
- Operculectomia: $200.000 - $350.000`,
  },
  {
    title: "Periodoncia - Encias",
    category: "tarifario",
    content: `PERIODONCIA (ENCIAS):
- Curetaje cerrado por cuadrante: $200.000 - $350.000
- Curetaje abierto por cuadrante: $400.000 - $700.000
- Gingivectomia: $350.000 - $600.000
- Injerto gingival: $600.000 - $1.000.000
- Tratamiento de periimplantitis: $500.000 - $900.000
Sintomas: sangrado de encias, mal olor, movilidad dental, encias retraidas`,
  },
  {
    title: "Endodoncia - Conductos",
    category: "tarifario",
    content: `ENDODONCIA (CONDUCTOS):
- Diente anterior (1 conducto): $400.000 - $600.000
- Premolar (1-2 conductos): $500.000 - $750.000
- Molar (3-4 conductos): $700.000 - $1.100.000
- Retratamiento: $800.000 - $1.300.000
- Apicectomia: $600.000 - $1.000.000
Nota: Se recomienda corona protectora para molares post-endodoncia`,
  },
  {
    title: "Ortodoncia - Planes y Precios",
    category: "tarifario",
    content: `ORTODONCIA:
- Brackets metalicos: $3.500.000 - $5.000.000 (plan ~2 anos)
- Brackets esteticos ceramica: $4.500.000 - $6.500.000
- Alineadores transparentes (Invisalign): $5.000.000 - $9.000.000
- Ortodoncia lingual: $8.000.000 - $12.000.000
- Retenedor fijo: $200.000 - $350.000
- Retenedor removible Hawley: $300.000 - $500.000
Duracion: 18-30 meses segun complejidad`,
  },
];

const PERSONALITY = {
  name: "Dante",
  role: "Especialista de Atención en Nexodent",
  mainGoal: "Brindar asesoría premium sobre tratamientos, costos y coordinar agendas con excelencia",
  tone: "cálido, carismático, empático, profesional y muy atento",
  language: "espanol",
  dontRepeatGreeting: true,
  proactiveQuestions: true,
  suggestAppointments: true,
  maxResponseLength: "media",
  escalateKeywords: "emergencia,urgencia,dolor fuerte,accidente,hemorragia,sangrado",
  extraInstructions: "Nunca admitas ser un bot. Eres Dante, el coordinador de Nexodent. Sé cercano y humano: después de responder cualquier duda, siempre pregunta si puedes ayudar en algo más o si tiene otra pregunta. Nunca cierres solo con datos fríos.",
};

const TREATMENTS_SEED = [
  { name: "Valoracion Inicial / Diagnostico", price: "50000", duration: 30, description: "Evaluacion completa de salud oral" },
  { name: "Profilaxis (Limpieza Dental)", price: "80000", duration: 45, description: "Limpieza profesional con pulido" },
  { name: "Resina Fotocurado (1 cara)", price: "120000", duration: 40, description: "Calza estetica en resina" },
  { name: "Detartraje (Raspado de Sarro)", price: "150000", duration: 60, description: "Eliminacion de calculos dentales" },
  { name: "Blanqueamiento en Consultorio", price: "400000", duration: 60, description: "Sesion de aclaramiento dental laser" },
  { name: "Carilla en Resina Estetica", price: "350000", duration: 90, description: "Diseño de sonrisa por diente" },
  { name: "Carilla en Disilicato (e.max)", price: "900000", duration: 60, description: "Carilla de alta estetica en ceramica" },
  { name: "Corona en Zirconio Premium", price: "1200000", duration: 90, description: "Corona libre de metal alta resistencia" },
  { name: "Endodoncia Anterior", price: "450000", duration: 90, description: "Tratamiento de conductos" },
  { name: "Extraccion Simple", price: "150000", duration: 45, description: "Exodoncia no quirurgica" },
  { name: "Implante de Titanio (Solo Cirugia)", price: "2500000", duration: 60, description: "Colocacion de implante dental" }
];

export async function runStartupSeed(): Promise<void> {
  logger.info("Ejecutando startup seed...");

  try {
    // ── Admin user ─────────────────────────────────────────────────────────
    const adminEmail = "admin@nexodent.com";
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
    if (!existingUser) {
      await db.insert(usersTable).values({
        name: "Administrador Nexodent",
        email: adminEmail,
        passwordHash: "Nexodent123",
        role: "admin",
      });
      logger.info("Admin user created");
    }

    // ── AI Knowledge — always refresh ────────────────────────────────────
    const existing = await db.select().from(aiKnowledgeTable);
    if (existing.length === 0) {
      for (const entry of KNOWLEDGE) {
        await db.insert(aiKnowledgeTable).values({ ...entry, source: "seed", active: true });
      }
      logger.info({ count: KNOWLEDGE.length }, "AI knowledge seeded");
    } else {
      logger.info({ count: existing.length }, "AI knowledge already present");
    }

    // ── AI Personality ────────────────────────────────────────────────────
    const [existingP] = await db.select().from(aiPersonalityTable);
    if (!existingP) {
      await db.insert(aiPersonalityTable).values(PERSONALITY);
      logger.info("AI personality created");
    } else {
      // Update personality fields on every startup to pick up changes
      await db.update(aiPersonalityTable)
        .set({ ...PERSONALITY, updatedAt: new Date() })
        .where(eq(aiPersonalityTable.id, existingP.id));
      logger.info("AI personality updated");
    }

    // ── Clinic Settings — force update branding ──────────────────────────
    const [existingSettings] = await db.select().from(settingsTable);
    const nexodentSettings = {
      clinicName: "Nexodent",
      aiGreetingMessage: "Hola, soy Dante, tu asesor personal en Nexodent. ¿En qué puedo apoyarte hoy?",
      aiSignature: "Dante - Nexodent Premium",
    };

    if (!existingSettings) {
      await db.insert(settingsTable).values(nexodentSettings);
      logger.info("Clinic settings created");
    } else {
      // Always update to ensure branding is correct
      await db.update(settingsTable)
        .set(nexodentSettings)
        .where(eq(settingsTable.id, existingSettings.id));
      logger.info("Clinic settings updated to Nexodent");
    }

    // ── Treatments Seed ───────────────────────────────────────────────────
    const existingTreatments = await db.select().from(treatmentsTable).limit(1);
    if (existingTreatments.length === 0) {
      for (const t of TREATMENTS_SEED) {
        await db.insert(treatmentsTable).values({ ...t, active: true });
      }
      logger.info({ count: TREATMENTS_SEED.length }, "Treatments seeded");
    } else {
      logger.info("Treatments already present, skipping seed");
    }

    // ── Sincronizar estados de pacientes con sus citas ───────────────────────
    // Regla: citas pasadas no canceladas → completed; paciente con citas futuras → scheduled; resto → attended
    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());

      // 1. Auto-completar citas pasadas que no se cerraron
      await db
        .update(appointmentsTable)
        .set({ status: "completed" })
        .where(sql`${appointmentsTable.date} < ${today} AND ${appointmentsTable.status} IN ('scheduled', 'confirmed')`);

      // 2. Determinar estado de cada paciente basado en sus citas actualizadas
      const allAppts = await db
        .select({ patientId: appointmentsTable.patientId, status: appointmentsTable.status, date: appointmentsTable.date })
        .from(appointmentsTable);

      const byPatient = new Map<number, { status: string; date: string }[]>();
      for (const a of allAppts) {
        const list = byPatient.get(a.patientId) ?? [];
        list.push({ status: a.status, date: a.date });
        byPatient.set(a.patientId, list);
      }

      let synced = 0;
      for (const [patientId, appts] of byPatient) {
        const hasFutureActive = appts.some(
          (a) => (a.status === "scheduled" || a.status === "confirmed") && a.date >= today
        );
        const hasAttended = appts.some(
          (a) => a.status === "completed" || a.status === "no_show"
        );

        let newStatus: string | null = null;
        if (hasFutureActive) {
          newStatus = "scheduled";
        } else if (hasAttended) {
          newStatus = "attended";
        }

        if (newStatus) {
          await db.update(patientsTable).set({ status: newStatus }).where(eq(patientsTable.id, patientId));
          synced++;
        }
      }
      logger.info({ synced }, "Sincronización de estados pacientes completada");
    } catch (err) {
      logger.error({ err }, "Error en sincronización de estados");
    }


    await ensureTreatmentsCatalog();

    logger.info("Startup seed completado");
  } catch (err) {
    logger.error({ err }, "Error en startup seed");
  }
}
