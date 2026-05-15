/**
 * Sincroniza el status de TODOS los pacientes con sus citas reales.
 * Ejecutar una sola vez para corregir los datos existentes.
 */
import { db, appointmentsTable, patientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🔄 Sincronizando estados de pacientes con sus citas...\n");

  const allAppts = await db
    .select({ patientId: appointmentsTable.patientId, status: appointmentsTable.status })
    .from(appointmentsTable);

  // Agrupar por paciente
  const byPatient = new Map<number, string[]>();
  for (const a of allAppts) {
    const list = byPatient.get(a.patientId) ?? [];
    list.push(a.status);
    byPatient.set(a.patientId, list);
  }

  console.log(`📋 Pacientes con citas: ${byPatient.size}\n`);

  let scheduled = 0, attended = 0, skipped = 0;

  for (const [patientId, statuses] of byPatient) {
    let newStatus: string | null = null;

    if (statuses.some((s) => s === "scheduled" || s === "confirmed")) {
      newStatus = "scheduled";
      scheduled++;
    } else if (statuses.some((s) => s === "completed" || s === "no_show")) {
      newStatus = "attended";
      attended++;
    } else {
      skipped++;
      continue; // solo cancelled, no tocar
    }

    const [p] = await db
      .update(patientsTable)
      .set({ status: newStatus })
      .where(eq(patientsTable.id, patientId))
      .returning({ id: patientsTable.id, name: patientsTable.name });

    console.log(`  ✅ [${p.id}] ${p.name} → ${newStatus}`);
  }

  console.log(`\n📊 Resumen:`);
  console.log(`  → ${scheduled} pacientes marcados como "Cita Agendada"`);
  console.log(`  → ${attended} pacientes marcados como "Atendido"`);
  console.log(`  → ${skipped} pacientes sin cambio (solo citas canceladas)`);
  console.log(`\n✅ Sincronización completada.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
