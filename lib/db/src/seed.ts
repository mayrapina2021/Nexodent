import { db, usersTable, aiKnowledgeTable, aiPersonalityTable } from "./index";
import { eq } from "drizzle-orm";

// ─── KNOWLEDGE BASE ────────────────────────────────────────────────────────────
const knowledge = [
  {
    title: "Información general del consultorio",
    category: "general",
    content: `Clínica: Dientes Fijos Medellín
Especialidad: Odontología estética, rehabilitación oral e implantes
Horario: Lunes a Sábado de 8:00 a.m. a 6:00 p.m.
Ubicación: Medellín, Colombia
Política de citas: Se requiere puntualidad. Cancelaciones con mínimo 24 horas de anticipación.
Formas de pago: Efectivo, transferencia bancaria, tarjetas débito y crédito. Se manejan planes de pago según el tratamiento.
Nota: Los precios son aproximados y pueden variar según evaluación clínica.`,
  },
  {
    title: "Información sobre pagos y política de citas",
    category: "general",
    content: `PAGOS Y FINANCIACIÓN:
- Efectivo, transferencias, tarjetas débito/crédito
- Planes de pago disponibles para tratamientos mayores (implantes, ortodoncia, rehabilitación)
- Se puede pagar por cuotas según acuerdo con el consultorio
- No se trabaja con seguros médicos directamente pero se expiden recibos para reembolso

POLÍTICA DE CITAS:
- Citas con puntualidad (espera máxima 10 minutos)
- Cancelar con 24 horas de anticipación para no perder cupo
- Primera cita: valoración y diagnóstico sin costo o con costo mínimo según caso
- Urgencias odontológicas se atienden según disponibilidad del día`,
  },
  {
    title: "Odontología General — Precios",
    category: "tarifario",
    content: `ODONTOLOGÍA GENERAL:
• Consulta de valoración / diagnóstico: $50.000 - $80.000
• Profilaxis (limpieza dental): $80.000 - $120.000
• Aplicación de flúor: $30.000 - $50.000
• Sellantes: $40.000 - $60.000 por diente
• Resina (obturación dental): $120.000 - $200.000 por diente
• Detartraje (raspado de sarro): $150.000 - $250.000
• Urgencia odontológica: $80.000 - $150.000
• Radiografía periapical: $30.000 - $50.000
• Radiografía panorámica: $80.000 - $120.000`,
  },
  {
    title: "Blanqueamiento Dental — Precios",
    category: "tarifario",
    content: `BLANQUEAMIENTO DENTAL:
• Blanqueamiento en consultorio (1 sesión): $350.000 - $500.000
• Blanqueamiento en casa (cubetas personalizadas): $250.000 - $350.000
• Plan combinado (consultorio + casa): $500.000 - $700.000
• Resultado esperado: 4-8 tonos más claro
• Duración del resultado: 1-3 años según cuidados
• Recomendado antes de carillas o diseño de sonrisa`,
  },
  {
    title: "Estética Dental — Carillas y Diseño de Sonrisa",
    category: "tarifario",
    content: `ESTÉTICA DENTAL:
• Carillas de cerómero (resina estética): $350.000 - $500.000 por diente
• Carillas de porcelana / disilicato de litio: $700.000 - $1.200.000 por diente
• Carillas de Zirconio: $800.000 - $1.300.000 por diente
• Diseño de sonrisa (plan completo): desde $3.000.000 según caso
• Microdiseño de sonrisa (ajuste de forma): $150.000 - $300.000 por diente
• Contorneado gingival (encías): $200.000 - $400.000
• Cierre de diastemas (espacios): $300.000 - $600.000
Nota: el diseño de sonrisa incluye evaluación digital previa sin costo`,
  },
  {
    title: "Rehabilitación Oral — Coronas y Prótesis",
    category: "tarifario",
    content: `REHABILITACIÓN ORAL:
• Corona de porcelana fused to metal (PFM): $600.000 - $900.000
• Corona de Zirconio (full ceramic): $900.000 - $1.400.000
• Corona de disilicato de litio (e.max): $1.000.000 - $1.500.000
• Incrustación (inlay/onlay) en resina: $350.000 - $500.000
• Incrustación en porcelana o zirconio: $600.000 - $900.000
• Núcleo (muñón colado o fibra de vidrio): $200.000 - $350.000
• Puente de 3 unidades (porcelana): $1.800.000 - $2.700.000
• Puente de 3 unidades (zirconio): $2.700.000 - $4.200.000
• Recementado de corona: $80.000 - $150.000
• Corona provisional: $150.000 - $250.000`,
  },
  {
    title: "Prótesis Dentales — Precios",
    category: "tarifario",
    content: `PRÓTESIS DENTALES:
• Prótesis parcial removible (Acker): $800.000 - $1.300.000
• Prótesis total (dentadura completa): $1.200.000 - $2.000.000
• Prótesis flexible (sin metal): $1.000.000 - $1.600.000
• Rebase de prótesis: $200.000 - $350.000
• Reparación de prótesis: $150.000 - $250.000
• Base de prótesis nueva: $900.000 - $1.400.000
• Gancho metálico adicional: $100.000 - $180.000`,
  },
  {
    title: "Implantes Dentales — Precios Completos",
    category: "tarifario",
    content: `IMPLANTES DENTALES:
• Implante de titanio (incluye corona): $3.500.000 - $5.000.000 por unidad
• Implante + corona de zirconio premium: $5.000.000 - $7.000.000
• Pilar protésico: $500.000 - $900.000
• Injerto óseo (regeneración): $1.500.000 - $2.500.000
• Membrana de colágeno: $500.000 - $800.000
• Elevación de seno maxilar: $2.000.000 - $3.500.000
• Sobredentadura (sobre implantes): $5.000.000 - $8.000.000
• Protocolo All-on-4 (arcada completa): desde $18.000.000
• Prótesis híbrida sobre implantes: desde $15.000.000
Tiempo de osteointegración: 3-6 meses
Nota: Los implantes requieren evaluación radiográfica previa (tomografía cone beam)`,
  },
  {
    title: "Cirugía Oral — Precios",
    category: "tarifario",
    content: `CIRUGÍA ORAL:
• Extracción simple: $150.000 - $250.000
• Extracción compleja / raíz retenida: $250.000 - $400.000
• Extracción de muela del juicio (cordal) erupcionada: $250.000 - $400.000
• Extracción de muela del juicio impactada (cirugía): $450.000 - $800.000
• Frenilectomía (labial o lingual): $300.000 - $500.000
• Biopsia de tejidos blandos: $350.000 - $600.000
• Alveoloplastia (preparación para prótesis): $400.000 - $700.000
• Operculectomía (capuchón): $200.000 - $350.000`,
  },
  {
    title: "Periodoncia — Encías y Soporte Dental",
    category: "tarifario",
    content: `PERIODONCIA (ENCÍAS):
• Curetaje cerrado por cuadrante: $200.000 - $350.000
• Curetaje abierto (cirugía periodontal) por cuadrante: $400.000 - $700.000
• Gingivectomía (corrección de encías): $350.000 - $600.000
• Injerto gingival: $600.000 - $1.000.000
• Remodelado de reborde alveolar: $400.000 - $700.000
• Tratamiento de periimplantitis: $500.000 - $900.000
Síntomas que requieren consulta: sangrado de encías, mal olor persistente, movilidad dental, encías retraídas`,
  },
  {
    title: "Endodoncia — Tratamiento de Conductos",
    category: "tarifario",
    content: `ENDODONCIA (CONDUCTOS):
• Endodoncia en diente anterior (1 conducto): $400.000 - $600.000
• Endodoncia en premolar (1-2 conductos): $500.000 - $750.000
• Endodoncia en molar (3-4 conductos): $700.000 - $1.100.000
• Retratamiento de endodoncia: $800.000 - $1.300.000
• Apicectomía: $600.000 - $1.000.000
Nota: Después de la endodoncia se recomienda corona protectora para molares`,
  },
  {
    title: "Ortodoncia — Planes y Precios",
    category: "tarifario",
    content: `ORTODONCIA:
• Ortodoncia con brackets metálicos: $3.500.000 - $5.000.000 (plan completo ~2 años)
• Ortodoncia con brackets estéticos (cerámica): $4.500.000 - $6.500.000
• Alineadores transparentes (Invisalign / similares): $5.000.000 - $9.000.000
• Ortodoncia lingual (invisible por dentro): $8.000.000 - $12.000.000
• Contenedor / retenedor fijo: $200.000 - $350.000
• Retenedor removible Hawley: $300.000 - $500.000
• Consulta inicial ortodoncia: $80.000 - $150.000
Duración promedio del tratamiento: 18-30 meses según complejidad
Incluye: controles mensuales, brackets, arcos y brackets de reposición`,
  },
];

// ─── PERSONALITY ───────────────────────────────────────────────────────────────
const personality = {
  name: "Andrea",
  role: "Asistente oficial de Dientes Fijos Medellín",
  mainGoal: "Ayudar a los pacientes con información sobre tratamientos, resolver dudas sobre precios y agendar citas dentales",
  tone: "cálida, profesional, empática y cercana",
  language: "español colombiano",
  dontRepeatGreeting: true,
  proactiveQuestions: true,
  suggestAppointments: true,
  maxResponseLength: "corta",
  escalateKeywords: "emergencia,urgencia,dolor fuerte,accidente,hemorragia,sangrado",
  extraInstructions: "Nunca admitas ser un bot o IA. Eres Andrea, parte del equipo humano de Dientes Fijos Medellín. Habla siempre en primera persona. Usa modismos colombianos de forma moderada.",
};

async function seed() {
  console.log("🌱 Iniciando seed de datos...");

  // ── Admin user ───────────────────────────────────────────────────────────────
  const adminEmail = "admin@dientesfijosmedellin.com";
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
  if (!existingUser) {
    await db.insert(usersTable).values({
      name: "Administrador",
      email: adminEmail,
      passwordHash: "Dientes123",
      role: "admin",
    });
    console.log("✅ Usuario admin creado");
  } else {
    console.log("ℹ️  Usuario admin ya existe");
  }

  // ── AI Knowledge ─────────────────────────────────────────────────────────────
  const existing = await db.select().from(aiKnowledgeTable);
  if (existing.length === 0) {
    for (const entry of knowledge) {
      await db.insert(aiKnowledgeTable).values({
        ...entry,
        source: "seed",
        active: true,
      });
    }
    console.log(`✅ ${knowledge.length} entradas de conocimiento insertadas`);
  } else {
    console.log(`ℹ️  Ya existen ${existing.length} entradas de conocimiento`);
  }

  // ── AI Personality ───────────────────────────────────────────────────────────
  const [existingPersonality] = await db.select().from(aiPersonalityTable);
  if (!existingPersonality) {
    await db.insert(aiPersonalityTable).values(personality);
    console.log("✅ Personalidad de Andrea creada");
  } else {
    console.log("ℹ️  Personalidad ya configurada");
  }

  console.log("✅ Seed completado correctamente");
}

seed().catch(console.error).finally(() => process.exit(0));
