import { db, usersTable } from "./index";
import { eq } from "drizzle-orm";

async function seed() {
  const email = "admin@dientesfijosmedellin.com";
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!existing) {
    await db.insert(usersTable).values({
      name: "Admin",
      email: email,
      passwordHash: "Dientes123",
      role: "admin",
    });
    console.log("Admin user created");
  } else {
    console.log("Admin user already exists");
  }
}

seed().catch(console.error).finally(() => process.exit(0));
