import { initAuthCreds, BufferJSON, type AuthenticationState, type SignalDataSet, type SignalDataTypeMap } from "@whiskeysockets/baileys";
import { db, whatsappAuthTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

async function writeKey(key: string, data: unknown): Promise<void> {
  const value = JSON.stringify(data, BufferJSON.replacer);
  await db
    .insert(whatsappAuthTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: whatsappAuthTable.key, set: { value } });
}

async function readKey<T>(key: string): Promise<T | null> {
  try {
    const [row] = await db.select().from(whatsappAuthTable).where(eq(whatsappAuthTable.key, key));
    if (!row) return null;
    return JSON.parse(row.value, BufferJSON.reviver) as T;
  } catch {
    return null;
  }
}

async function deleteKey(key: string): Promise<void> {
  await db.delete(whatsappAuthTable).where(eq(whatsappAuthTable.key, key));
}

export async function usePostgresAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuth: () => Promise<void>;
}> {
  const creds = (await readKey<any>("creds")) ?? initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(
        type: T,
        ids: string[],
      ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        await Promise.all(
          ids.map(async (id) => {
            const value = await readKey<SignalDataTypeMap[T]>(`${type}:${id}`);
            if (value) result[id] = value;
          }),
        );
        return result;
      },

      set: async (data: SignalDataSet): Promise<void> => {
        const tasks: Promise<void>[] = [];
        for (const category of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
          const categoryData = data[category];
          if (!categoryData) continue;
          for (const id of Object.keys(categoryData)) {
            const value = categoryData[id];
            const key = `${String(category)}:${id}`;
            if (value != null) {
              tasks.push(writeKey(key, value));
            } else {
              tasks.push(deleteKey(key));
            }
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async (): Promise<void> => {
    await writeKey("creds", state.creds);
  };

  const clearAuth = async (): Promise<void> => {
    logger.info("Clearing WhatsApp auth from DB");
    // Delete all auth keys
    const rows = await db.select().from(whatsappAuthTable);
    await Promise.all(rows.map((r) => deleteKey(r.key)));
  };

  return { state, saveCreds, clearAuth };
}
