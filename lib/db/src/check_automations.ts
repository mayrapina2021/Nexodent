import { db, automationsTable } from "./index";

async function check() {
  const all = await db.select().from(automationsTable);
  console.log(JSON.stringify(all, null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
