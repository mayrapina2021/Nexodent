import { db, treatmentsTable } from "./lib/db/src/index.ts";
import { eq } from "drizzle-orm";

const treatments = [
  { name: "VALORACION INICIAL", description: "Consulta de diagnóstico y plan de tratamiento", price: 50000, duration: 30 },
  { name: "LIMPIEZA PROFUNDA (DETARTRAJE)", description: "Eliminación de sarro y pulido dental", price: 150000, duration: 45 },
  { name: "RESINA FOTOCURADO (1 CARA)", description: "Calza estética en resina de alta calidad", price: 120000, duration: 40 },
  { name: "RESINA FOTOCURADO (2 CARAS)", description: "Calza estética compleja", price: 180000, duration: 60 },
  { name: "EXODONCIA SIMPLE", description: "Extracción dental no quirúrgica", price: 150000, duration: 45 },
  { name: "ORTODONCIA CONVENCIONAL (INICIO)", description: "Instalación de brackets metálicos", price: 350000, duration: 90 },
  { name: "PROTESIS TOTAL SUPERIOR ACRILICA", description: "Caja de dientes completa superior", price: 950000, duration: 60 },
  { name: "DISEÑO DE SONRISA (RESINA)", description: "Carillas en resina estética (parcial)", price: 2500000, duration: 180 },
  { name: "CARILLAS EN DISILICATO", description: "Carillas de porcelana de alta estética (por diente)", price: 1200000, duration: 60 },
  { name: "ENDODONCIA MONORRADICULAR", description: "Tratamiento de conducto en diente de una raíz", price: 450000, duration: 90 },
  { name: "CORONA EN ZIRCONIO", description: "Corona estética libre de metal", price: 1300000, duration: 60 },
  { name: "IMPLANTE DENTAL (CIRUGIA)", description: "Colocación quirúrgica de implante de titanio", price: 2500000, duration: 60 }
];

async function main() {
  console.log(`Poblando base de datos con ${treatments.length} tratamientos...`);
  for (const t of treatments) {
    const [exists] = await db.select().from(treatmentsTable).where(eq(treatmentsTable.name, t.name));
    if (!exists) {
      await db.insert(treatmentsTable).values({
        name: t.name,
        description: t.description,
        price: t.price.toString(),
        duration: t.duration,
        active: true
      });
      console.log(`✅ Agregado: ${t.name}`);
    } else {
      console.log(`⏭️ Ya existe: ${t.name}`);
    }
  }
  console.log("Carga masiva finalizada.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
