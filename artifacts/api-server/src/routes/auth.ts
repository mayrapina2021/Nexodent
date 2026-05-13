import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

// In-memory token store: token → userId
// Simple and effective for single-instance deployment
const tokenStore = new Map<string, number>();

function generateToken(userId: number): string {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const token = `tk_${userId}_${rand}`;
  tokenStore.set(token, userId);
  return token;
}

export function getUserIdFromToken(token: string | undefined): number | null {
  if (!token) return null;
  return tokenStore.get(token) ?? null;
}

export function invalidateToken(token: string): void {
  tokenStore.delete(token);
}

// Middleware helper: reads Bearer token from Authorization header or session fallback
export function extractToken(req: any): string | undefined {
  const authHeader = req.headers["authorization"] as string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return undefined;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Also keep session for backwards compat
  (req.session as any).userId = user.id;

  const token = generateToken(user.id);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    token,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = extractToken(req);
  if (token) invalidateToken(token);
  req.session.destroy(() => {});
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  // Try Bearer token first (works cross-origin)
  const token = extractToken(req);
  let userId = token ? getUserIdFromToken(token) : null;

  // Fallback to session cookie
  if (!userId) {
    userId = (req.session as any).userId as number | undefined ?? null;
  }

  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
});

export default router;
