import crypto from "node:crypto";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/http";
import { seedUserDefaults } from "../../seed";

const SESSION_DAYS = 30;

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export async function createSession(user: AuthUser) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma().session.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
  });
  return { token, user };
}

export async function getUserFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await prisma().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.lockedAt) return null;
  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}

export async function registerUser(input: { username: string; displayName?: string; password: string }) {
  const username = normalizeUsername(input.username);
  if (username.length < 3) throw new ApiError(400, "El usuario debe tener al menos 3 caracteres");
  if (input.password.length < 4) throw new ApiError(400, "La contrasena debe tener al menos 4 caracteres");
  const existing = await prisma().user.findUnique({ where: { username } });
  if (existing) throw new ApiError(409, "Ese usuario ya existe");
  const count = await prisma().user.count();
  const role = count === 0 ? "ADMIN" : "USER";
  const user = await prisma().user.create({
    data: {
      username,
      displayName: input.displayName?.trim() || input.username.trim(),
      passwordHash: hashPassword(input.password),
      role,
    },
  });
  await seedUserDefaults(user.id);
  return createSession({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
}

export async function loginUser(input: { username: string; password: string }) {
  const user = await prisma().user.findUnique({ where: { username: normalizeUsername(input.username) } });
  if (!user || user.lockedAt || !verifyPassword(input.password, user.passwordHash)) {
    throw new ApiError(401, "Usuario o contrasena incorrectos");
  }
  return createSession({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
}

export async function logoutToken(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma().session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
