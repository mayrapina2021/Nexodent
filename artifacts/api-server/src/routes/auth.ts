import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { createHmac, timingSafeEqual } from "crypto";

const router: IRouter = Router();

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dientes-fijos-secret-key-2024";
}

// ─── Simple signed token: base64(payload).signature ──────────────────────────
export function createToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): number | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
    const { uid } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof uid === "number" ? uid : null;
  } catch {
    return null;
  }
}

export function extractToken(req: any): string | undefined {
  const authHeader = req.headers["authorization"] as string | undefined;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return undefined;
}

// ─── Routes ──────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Session fallback kept for same-origin contexts
  (req.session as any).userId = user.id;

  const token = createToken(user.id);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    token,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {});
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  // Try Bearer token first (cross-origin safe, survives server restarts)
  const token = extractToken(req);
  let userId = token ? verifyToken(token) : null;

  // Fallback to session cookie
  if (!userId) {
    userId = (req.session as any).userId as number | undefined ?? null;
  }

  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
});

export default router;
