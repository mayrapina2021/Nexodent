import { db, usersTable, aiKnowledgeTable, aiPersonalityTable } from "./index";
import { eq } from "drizzle-orm";

const knowledge = [
  {
    title: "Informacion general del consultorio",
    category: "general",
    content: `Clinica: Dientes Fijos Medellin
Especialidad: Odontologia estetica, rehabilitacion oral e implantes
Horario: Lunes a Sabado de 8:00 a.m. a 6:00 p.m.
Ubicacion: Medellin, Colombia
Politica de citas: Se requiere puntualidad. Cancelaciones con minimo 24 horas de anticipacion.
Formas de pago: Efectivo, transferencia bancaria, tarjetas debito y credito. Se manejan planes de pago segun el tratamiento.
Nota: Los precios son aproximados y pueden variar segun evaluacion clinica.`,
  },
  {
    title: "Informacion sobre pagos y politica de citas",
    category: "general",
    content: `PAGOS Y FINANCIACION:
- Efectivo, transferencias, tarjetas debito/credito
- Planes de pago disponibles para tratamientos mayores (implantes, ortodoncia, rehabilitacion)
- Se puede pagar por cuotas segun acuerdo con el consultorio
- No se trabaja con seguros medicos directamente pero se expiden recibos para reembolso

POLITICA DE CITAS:
- Citas con puntualidad (espera maxima 10 minutos)
- Cancelar con 24 horas de anticipacion para no perder cupo
- Primera cita: valoracion y diagnostico sin costo o con costo minimo segun caso
- Urgencias odontologicas se atienden segun disponibilidad del dia`,
  },
  {
    title: "Odontologia General - Precios",
    category: "tarifario",
    content: `ODONTOLOGIA GENERAL:
- Consulta de valoracion / diagnostico: $50.000 - $80.000
- Profilaxis (limpieza dental): $80.000 - $120.000
- Aplicacion de fluor: $30.000 - $50.000
- Sellantes: $40.000 - $60.000 por diente
- Resina (obturacion dental): $120.000 - $200.000 por diente
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
- Blanqueamiento en casa (cubetas personalizadas): $250.000 - $350.000
- Plan combinado (consultorio + casa): $500.000 - $700.000
- Resultado esperado: 4-8 tonos mas claro
- Duracion del resultado: 1-3 anos segun cuidados
- Recomendado antes de carillas o diseno de sonrisa`,
  },
  {
    title: "Estetica Dental - Carillas y Diseno de Sonrisa",
    category: "tarifario",
    content: `ESTETICA DENTAL:
- Carillas de ceromero (resina estetica): $350.000 - $500.000 por diente
- Carillas de porcelana / disilicato de litio: $700.000 - $1.200.000 por diente
- Carillas de Zirconio: $800.000 - $1.300.000 por diente
- Diseno de sonrisa (plan completo): desde $3.000.000 segun caso
- Microdiseno de sonrisa (ajuste de forma): $150.000 - $300.000 por diente
- Contorneado gingival (encias): $200.000 - $400.000
- Cierre de diastemas (espacios): $300.000 - $600.000
Nota: el diseno de sonrisa incluye evaluacion digital previa sin costo`,
  },
  {
    title: "Rehabilitacion Oral - Coronas y Protesis",
    category: "tarifario",
    content: `REHABILITACION ORAL:
- Corona de porcelana fused to metal (PFM): $600.000 - $900.000
- Corona de Zirconio (full ceramic): $900.000 - $1.400.000
- Corona de disilicato de litio (e.max): $1.000.000 - $1.500.000
- Incrustacion (inlay/onlay) en resina: $350.000 - $500.000
- Incrustacion en porcelana o zirconio: $600.000 - $900.000
- Nucleo (munon colado o fibra de vidrio): $200.000 - $350.000
- Puente de 3 unidades (porcelana): $1.800.000 - $2.700.000
- Puente de 3 unidades (zirconio): $2.700.000 - $4.200.000
- Recementado de corona: $80.000 - $150.000
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
- Reparacion de protesis: $150.000 - $250.000
- Base de protesis nueva: $900.000 - $1.400.000
- Gancho metalico adicional: $100.000 - $180.000`,
  },
  {
    title: "Implantes Dentales - Precios Completos",
    category: "tarifario",
    content: `IMPLANTES DENTALES:
- Implante de titanio (incluye corona): $3.500.000 - $5.000.000 por unidad
- Implante + corona de zirconio premium: $5.000.000 - $7.000.000
- Pilar protetico: $500.000 - $900.000
- Injerto oseo (regeneracion): $1.500.000 - $2.500.000
- Membrana de colageno: $500.000 - $800.000
- Elevacion de seno maxilar: $2.000.000 - $3.500.000
- Sobredentadura (sobre implantes): $5.000.000 - $8.000.000
- Protocolo All-on-4 (arcada completa): desde $18.000.000
- Protesis hibrida sobre implantes: desde $15.000.000
Tiempo de osteointergracion: 3-6 meses
Nota: Los implantes requieren evaluacion radiografica previa`,
  },
  {
    title: "Cirugia Oral - Precios",
    category: "tarifario",
    content: `CIRUGIA ORAL:
- Extraccion simple: $150.000 - $250.000
- Extraccion compleja / raiz retenida: $250.000 - $400.000
- Extraccion de muela del juicio erupcionada: $250.000 - $400.000
- Extraccion de muela del juicio impactada (cirugia): $450.000 - $800.000
- Frenilectomia (labial o lingual): $300.000 - $500.000
- Biopsia de tejidos blandos: $350.000 - $600.000
- Alveoloplastia (preparacion para protesis): $400.000 - $700.000
- Operculectomia (capuchon): $200.000 - $350.000`,
  },
  {
    title: "Periodoncia - Encias y Soporte Dental",
    category: "tarifario",
    content: `PERIODONCIA (ENCIAS):
- Curetaje cerrado por cuadrante: $200.000 - $350.000
- Curetaje abierto (cirugia periodontal) por cuadrante: $400.000 - $700.000
- Gingivectomia (correccion de encias): $350.000 - $600.000
- Injerto gingival: $600.000 - $1.000.000
- Remodelado de reborde alveolar: $400.000 - $700.000
- Tratamiento de periimplantitis: $500.000 - $900.000
Sintomas que requieren consulta: sangrado de encias, mal olor persistente, movilidad dental, encias retraidas`,
  },
  {
    title: "Endodoncia - Tratamiento de Conductos",
    category: "tarifario",
    content: `ENDODONCIA (CONDUCTOS):
- Endodoncia en diente anterior (1 conducto): $400.000 - $600.000
- Endodoncia en premolar (1-2 conductos): $500.000 - $750.000
- Endodoncia en molar (3-4 conductos): $700.000 - $1.100.000
- Retratamiento de endodoncia: $800.000 - $1.300.000
- Apicectomia: $600.000 - $1.000.000
Nota: Despues de la endodoncia se recomienda corona protectora para molares`,
  },
  {
    title: "Ortodoncia - Planes y Precios",
    category: "tarifario",
    content: `ORTODONCIA:
- Ortodoncia con brackets metalicos: $3.500.000 - $5.000.000 (plan completo ~2 anos)
- Ortodoncia con brackets esteticos (ceramica): $4.500.000 - $6.500.000
- Alineadores transparentes (Invisalign / similares): $5.000.000 - $9.000.000
- Ortodoncia lingual (invisible por dentro): $8.000.000 - $12.000.000
- Contenedor / retenedor fijo: $200.000 - $350.000
- Retenedor removible Hawley: $300.000 - $500.000
- Consulta inicial ortodoncia: $80.000 - $150.000
Duracion promedio del tratamiento: 18-30 meses segun complejidad
Incluye: controles mensuales, brackets, arcos y reposicion de brackets`,
  },
];

const personality = {
  name: "Andrea",
  role: "Asistente oficial de Dientes Fijos Medellín",
  mainGoal: "Ayudar a los pacientes con información sobre tratamientos, resolver dudas sobre precios y agendar citas dentales",
  tone: "respetuosa, profesional, amable y cálida (estilo Paisa)",
  language: "español de Colombia (Medellín)",
  dontRepeatGreeting: true,
  proactiveQuestions: true,
  suggestAppointments: true,
  maxResponseLength: "corta",
  escalateKeywords: "emergencia,urgencia,dolor fuerte,accidente,hemorragia,sangrado",
  extraInstructions: "Eres Andrea, parte del equipo humano de Dientes Fijos Medellín. Tu tono debe ser siempre muy respetuoso y profesional, pero con la amabilidad y calidez característica de Medellín. NUNCA uses términos demasiado informales como 'mi amor', 'cariño', 'bacano' o 'chévere'. Mantén siempre la seriedad que requiere un servicio de salud dental, presentándote con tu nombre y enfocándote en ayudar al paciente con eficiencia.",
};

async function seed() {
  console.log("Iniciando seed de datos...");

  // Admin user
  const adminEmail = "admin@dientesfijosmedellin.com";
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
  if (!existingUser) {
    await db.insert(usersTable).values({
      name: "Administrador",
      email: adminEmail,
      passwordHash: "Dientes123",
      role: "admin",
    });
    console.log("Usuario admin creado");
  } else {
    console.log("Usuario admin ya existe");
  }

  // AI Knowledge - FORCE DELETE AND REINSERT
  console.log("Eliminando entradas de conocimiento previas...");
  await db.delete(aiKnowledgeTable);
  
  for (const entry of knowledge) {
    await db.insert(aiKnowledgeTable).values({
      ...entry,
      source: "seed",
      active: true,
    });
  }
  console.log(`${knowledge.length} entradas de conocimiento insertadas`);

  // AI Personality - FORCE UPSERT
  const [existingPersonality] = await db.select().from(aiPersonalityTable);
  if (!existingPersonality) {
    await db.insert(aiPersonalityTable).values(personality);
    console.log("Personalidad de Andrea creada");
  } else {
    await db.update(aiPersonalityTable)
      .set({ ...personality, updatedAt: new Date() })
      .where(eq(aiPersonalityTable.id, existingPersonality.id));
    console.log("Personalidad de Andrea actualizada");
  }

  console.log("Seed completado correctamente");
}

seed().catch(console.error).finally(() => process.exit(0));
