import { ensurePaymentsTable } from "./ensure-payments-table";
import { ensureSchemaColumns } from "./ensure-schema-columns";
import { logger } from "./logger";

/** Ejecutar antes de aceptar peticiones — evita 500 por columnas/tablas faltantes. */
export async function ensureDatabase(): Promise<void> {
  logger.info("Verificando esquema de base de datos...");
  await ensurePaymentsTable();
  await ensureSchemaColumns();
  logger.info("Esquema de base de datos listo");
}
