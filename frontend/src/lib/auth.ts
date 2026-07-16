const USERS_KEY = "personal-control-users-v1";
const SESSION_KEY = "personal-control-session-v1";

export type UserRole = "ADMIN" | "USER";

export interface LocalUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  lockedAt?: string | null;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  activeOwnerUserId: string;
  activeOwnerDisplayName: string;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function randomId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password: string, salt: string): Promise<string> {
  return sha256(`${salt}:${password}`);
}

export async function listUsers(): Promise<LocalUser[]> {
  const users = await readJson<Array<Omit<LocalUser, "role"> & { role?: UserRole; lockedAt?: string | null }>>(
    USERS_KEY,
    [],
  );
  const migrated = users.map((user) => ({
    ...user,
    role: user.role ?? "USER",
    lockedAt: user.lockedAt ?? null,
  }));
  if (users.some((user) => !user.role || user.lockedAt === undefined)) {
    await writeJson(USERS_KEY, migrated);
  }
  return migrated;
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const session = await readJson<AuthSession | null>(SESSION_KEY, null);
  if (!session) return null;
  const users = await listUsers();
  const currentUser = users.find((user) => user.id === session.userId);
  if (!currentUser) {
    await setCurrentSession(null);
    return null;
  }
  const activeOwner =
    currentUser.role === "ADMIN"
      ? users.find((user) => user.id === session.activeOwnerUserId) ?? currentUser
      : currentUser;
  const normalized: AuthSession = {
    userId: currentUser.id,
    username: currentUser.username,
    displayName: currentUser.displayName,
    role: currentUser.role,
    activeOwnerUserId: activeOwner.id,
    activeOwnerDisplayName: activeOwner.displayName,
  };
  await setCurrentSession(normalized);
  return normalized;
}

export async function setCurrentSession(session: AuthSession | null): Promise<void> {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  await writeJson(SESSION_KEY, session);
}

export async function requireCurrentDataUserId(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) throw new Error("No hay usuario activo");
  return session.role === "ADMIN" ? session.activeOwnerUserId : session.userId;
}

export async function createUser(input: {
  username: string;
  displayName?: string;
  password: string;
  activate?: boolean;
  role?: UserRole;
}): Promise<AuthSession> {
  const username = normalizeUsername(input.username);
  if (username.length < 3) throw new Error("El usuario debe tener al menos 3 caracteres");
  if (input.password.length < 4) throw new Error("La contrasena debe tener al menos 4 caracteres");

  const users = await listUsers();
  if (users.some((user) => user.username === username)) {
    throw new Error("Ese usuario ya existe");
  }

  const salt = randomSalt();
  const role: UserRole = input.role ?? "USER";
  const user: LocalUser = {
    id: randomId(),
    username,
    displayName: input.displayName?.trim() || input.username.trim(),
    role,
    lockedAt: null,
    salt,
    passwordHash: await passwordHash(input.password, salt),
    createdAt: new Date().toISOString(),
  };
  await writeJson(USERS_KEY, [...users, user]);
  const session = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    activeOwnerUserId: user.id,
    activeOwnerDisplayName: user.displayName,
  };
  if (input.activate ?? true) await setCurrentSession(session);
  return session;
}

export async function loginUser(usernameInput: string, password: string): Promise<AuthSession> {
  const username = normalizeUsername(usernameInput);
  const user = (await listUsers()).find((candidate) => candidate.username === username);
  if (!user) throw new Error("Usuario o contrasena incorrectos");
  if (user.lockedAt) throw new Error("Usuario bloqueado");
  const hash = await passwordHash(password, user.salt);
  if (hash !== user.passwordHash) throw new Error("Usuario o contrasena incorrectos");
  const session = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    activeOwnerUserId: user.id,
    activeOwnerDisplayName: user.displayName,
  };
  await setCurrentSession(session);
  return session;
}

export async function changeUserPassword(userId: string, password: string): Promise<void> {
  if (password.length < 4) throw new Error("La contrasena debe tener al menos 4 caracteres");
  const users = await listUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) throw new Error("Usuario no encontrado");
  const user = users[index];
  if (!user) throw new Error("Usuario no encontrado");
  const salt = randomSalt();
  users[index] = {
    ...user,
    salt,
    passwordHash: await passwordHash(password, salt),
  };
  await writeJson(USERS_KEY, users);
}

export async function setUserLocked(userId: string, locked: boolean): Promise<void> {
  const users = await listUsers();
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("Usuario no encontrado");
  if (user.role === "ADMIN" && locked) throw new Error("No puedes bloquear al admin");
  await writeJson(
    USERS_KEY,
    users.map((candidate) =>
      candidate.id === userId ? { ...candidate, lockedAt: locked ? new Date().toISOString() : null } : candidate,
    ),
  );
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const users = await listUsers();
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("Usuario no encontrado");
  const adminCount = users.filter((candidate) => candidate.role === "ADMIN").length;
  if (user.role === "ADMIN" && role !== "ADMIN" && adminCount <= 1) {
    throw new Error("Debe quedar al menos un admin");
  }
  await writeJson(
    USERS_KEY,
    users.map((candidate) => (candidate.id === userId ? { ...candidate, role } : candidate)),
  );
}

export async function switchActiveOwner(ownerUserId: string): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) throw new Error("No hay usuario activo");
  const users = await listUsers();
  const owner = users.find((user) => user.id === ownerUserId);
  if (!owner) throw new Error("Usuario no encontrado");
  if (session.role !== "ADMIN" && owner.id !== session.userId) {
    throw new Error("Solo el admin puede ver otros usuarios");
  }
  const nextSession = {
    ...session,
    activeOwnerUserId: owner.id,
    activeOwnerDisplayName: owner.displayName,
  };
  await setCurrentSession(nextSession);
  return nextSession;
}

export async function logoutUser(): Promise<void> {
  await setCurrentSession(null);
}
