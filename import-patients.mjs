import { db, patientsTable } from "./lib/db/src/index.ts";
import { eq } from "drizzle-orm";





const rawData = [
  { "name": "HERNANDO RAMIREZ DUQUE", "phone": "3022699086", "treatment": "PROTESIS TOTAL SUPERIOR ACRILICA" },
  { "name": "SANTIAGO JARAMILLO", "phone": "3206083966", "treatment": "ORTODONCIA CONVENCIONAL O AUTOLIGADO" },
  { "name": "MARIBEL REHOLLEDO", "phone": "3013053763", "treatment": "Consulta general" },
  { "name": "JHON ESTEBAN RESTREPO", "phone": "3193414766", "treatment": "ORTODONCIA CONVENCIOANL" },
  { "name": "CLAUDIA SERRANO", "phone": "3014895645", "treatment": "LIMPIEZA" },
  { "name": "ALICIA GIOVANA GUIRAL", "phone": "3019642351", "treatment": "PROTESIS" },
  { "name": "CARMEN CECILIA AÑEZ", "phone": "3023371974", "treatment": "LIMPIEZA - PERIAPICAL" },
  { "name": "POLA PAZ AYALA", "phone": "3011726865", "treatment": "CARILLAS EN DISILICATO" },
  { "name": "JORGE LEAVY", "phone": "3238385475", "treatment": "PROTESIS SUP- CARILLAS EN RESINA" },
  { "name": "KEVIN RADAL GIL", "phone": "3011216921", "treatment": "DISEÑO DE SONRISA" },
  { "name": "MARTHA LIGIA JIMENEZ", "phone": "3105158592", "treatment": "PROTESIS" },
  { "name": "YENIFER CAROLINA OLIVARES", "phone": "3023371974", "treatment": "ORTODONCIA CONVENCIONAL" },
  { "name": "GLORIA NERY GARCIA", "phone": "3127950520", "treatment": "FASE HIGIENICA , CAMBIO DE CORONA 22 Y AMALGAMA V 24" },
  { "name": "ELMER ARANGO VASQUEZ", "phone": "71946077", "treatment": "CAMBIO DE AMALGAMA 37 36 16 26" },
  { "name": "ROSALBA RAMIREZ", "phone": "3102884882", "treatment": "Consulta general" },
  { "name": "MARIA VIDALIA VASQUEZ", "phone": "3217086151", "treatment": "PLACA ESTETICA SUPERIOR ( MAS EXODONCIA )" },
  { "name": "FABIO ORTIZ", "phone": "3128089560", "treatment": "IMPLANTE 22  ,  EXODONCIA" },
  { "name": "KLEIDER USUGA", "phone": "3044720975", "treatment": "MICRODISEÑO" },
  { "name": "MARIA EUGENIA ECHEVERRI", "phone": "3235240129", "treatment": "DISEÑO DE SONRISA" },
  { "name": "MIRIAM RAQUEL ROBLEDO", "phone": "3103532290", "treatment": "LIMPIEZA- EXODONCIA RR" },
  { "name": "YAIR MARTINEZ", "phone": "3045720944", "treatment": "ORTODONCIA" },
  { "name": "ALEJANDRA PALACIOS", "phone": "3044029395", "treatment": "ORTODONCIA" },
  { "name": "SARA OLIVO", "phone": "3173749974", "treatment": "LIMPIEZA" },
  { "name": "RUBBY SANTAMARIA", "phone": "3103885950", "treatment": "LIMPIEZA, PROTESIS , EXODONCIAS" },
  { "name": "ORNALIZ DIAZ", "phone": "3117171598", "treatment": "LIMPIEZA" },
  { "name": "JHONATAN VILLA", "phone": "3102781887", "treatment": "RESINA" },
  { "name": "SANDRA MILENA PIEDRAHITA", "phone": "3007897911", "treatment": "PROTESIS SUPERIOR" },
  { "name": "CARMEN ROJAS", "phone": "3118009932", "treatment": "PROTESIS SUPERIOR" },
  { "name": "MARIA FERNANDA URIBE", "phone": "3108501091", "treatment": "ORTODONCIA CONVENCIONAL" },
  { "name": "ISAURA CAMACHO", "phone": "3108501091", "treatment": "2 CARILLA EN DISCILICATO" },
  { "name": "MARIA FERNANDA GOMEZ", "phone": "3155235757", "treatment": "VALORACION" },
  { "name": "MARITZA PEREZA", "phone": "3158854675", "treatment": "PROTESIS REMOVIBLE TOTAL" },
  { "name": "MARELVIS MENDEZ", "phone": "3158854675", "treatment": "ORTODONCIA CONVENCIONAL" },
  { "name": "LAURA RIVERA", "phone": "3206425181", "treatment": "ORTODONCIA CONVENCIOANL" },
  { "name": "SHELVY UMBHA", "phone": "3004916968", "treatment": "LIMPIEZA , IMPLANTES, ENDODONCIA" },
  { "name": "MARQUINI ADRIANA CHACI", "phone": "3045554198", "treatment": "2 ACKER" },
  { "name": "CECILIA LOPEZ", "phone": "3023518033", "treatment": "RADIOGRAFIA PERIAPICAL" },
  { "name": "DAHIANA OCAMPO", "phone": "3011460035", "treatment": "Consulta general" },
  { "name": "DAVID SANTIAGO BARRERA", "phone": "3123424887", "treatment": "DISEÑO DE SONRISA" },
  { "name": "KARINA GRACIANO", "phone": "3207645785", "treatment": "Consulta general" }
];

async function main() {
  console.log(`Importando ${rawData.length} pacientes...`);
  for (const p of rawData) {
    const cleanPhone = p.phone.toString().replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("57") ? `+${cleanPhone}` : `+57${cleanPhone}`;
    
    const [exists] = await db.select().from(patientsTable).where(eq(patientsTable.phone, formattedPhone));
    if (!exists) {
      await db.insert(patientsTable).values({
        name: p.name.trim(),
        phone: formattedPhone,
        treatment: p.treatment,
        status: "new"
      });
      console.log(`✅ Registrado: ${p.name}`);
    } else {
      console.log(`⏭️ Ya existe: ${p.name}`);
    }
  }
  console.log("Importación finalizada.");
}

main();
