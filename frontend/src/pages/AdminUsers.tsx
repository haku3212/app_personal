import { useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { Download, Eye, KeyRound, Lock, Shield, ShieldCheck, Unlock, Upload, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import {
  changeUserPassword,
  createUser,
  setUserLocked,
  setUserRole,
  type LocalUser,
  type UserRole,
} from "@/lib/auth";

const STORE_PREFIX = "personal-control-mobile-db-v1";
const USER_DATA_PREFIXES = [
  "personal-control-mobile-db-v1",
  "personal-control-budgets-v1",
  "personal-control-recurring-v1",
  "personal-control-cashbox-v1",
];

interface UserSummary {
  incomes: number;
  expenses: number;
  worklogs: number;
  loans: number;
  goals: number;
  notes: number;
  lastActivity?: string;
}

function getUserSummary(userId: string): UserSummary {
  const raw = localStorage.getItem(`${STORE_PREFIX}:${userId}`);
  if (!raw) return { incomes: 0, expenses: 0, worklogs: 0, loans: 0, goals: 0, notes: 0 };
  try {
    const db = JSON.parse(raw) as {
      incomes?: Array<{ date?: string }>;
      expenses?: Array<{ date?: string }>;
      worklogs?: Array<{ date?: string }>;
      loans?: Array<{ date?: string }>;
      goals?: Array<{ targetDate?: string }>;
      notes?: Array<{ updatedAt?: string }>;
    };
    const dates = [
      ...(db.incomes ?? []).map((item) => item.date),
      ...(db.expenses ?? []).map((item) => item.date),
      ...(db.worklogs ?? []).map((item) => item.date),
      ...(db.loans ?? []).map((item) => item.date),
      ...(db.goals ?? []).map((item) => item.targetDate),
      ...(db.notes ?? []).map((item) => item.updatedAt),
    ].filter(Boolean) as string[];
    return {
      incomes: db.incomes?.length ?? 0,
      expenses: db.expenses?.length ?? 0,
      worklogs: db.worklogs?.length ?? 0,
      loans: db.loans?.length ?? 0,
      goals: db.goals?.length ?? 0,
      notes: db.notes?.length ?? 0,
      lastActivity: dates.sort((a, b) => b.localeCompare(a))[0],
    };
  } catch {
    return { incomes: 0, expenses: 0, worklogs: 0, loans: 0, goals: 0, notes: 0 };
  }
}

export function AdminUsers() {
  const { session, users, refreshUsers, switchOwner } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<LocalUser | null>(null);
  const [form, setForm] = useState({ username: "", displayName: "", password: "" });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const [importingUser, setImportingUser] = useState<LocalUser | null>(null);
  const summaries = useMemo(
    () => new Map(users.map((user) => [user.id, getUserSummary(user.id)])),
    [users],
  );

  if (session?.role !== "ADMIN") {
    return (
      <div>
        <PageHeader title="Admin" description="Esta seccion solo esta disponible para administradores." />
      </div>
    );
  }

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const createNewUser = async () => {
    resetMessages();
    try {
      await createUser({ ...form, activate: false });
      await refreshUsers();
      setForm({ username: "", displayName: "", password: "" });
      setCreateOpen(false);
      setMessage("Usuario creado correctamente.");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const changePassword = async () => {
    if (!passwordUser) return;
    resetMessages();
    try {
      await changeUserPassword(passwordUser.id, password);
      setPassword("");
      setPasswordUser(null);
      setMessage("Contrasena actualizada.");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleLock = async (user: LocalUser) => {
    resetMessages();
    try {
      await setUserLocked(user.id, !user.lockedAt);
      await refreshUsers();
      setMessage(user.lockedAt ? "Usuario desbloqueado." : "Usuario bloqueado.");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateRole = async (user: LocalUser, role: UserRole) => {
    resetMessages();
    try {
      await setUserRole(user.id, role);
      await refreshUsers();
      setMessage("Rol actualizado.");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const exportUser = (user: LocalUser) => {
    const data = Object.fromEntries(
      USER_DATA_PREFIXES.map((prefix) => [`${prefix}:${user.id}`, localStorage.getItem(`${prefix}:${user.id}`)]),
    );
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), user: { id: user.id, username: user.username, displayName: user.displayName }, data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personal-control-${user.username}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importUserData = async (file: File, user: LocalUser) => {
    resetMessages();
    try {
      const parsed = JSON.parse(await file.text()) as { data?: Record<string, string | null> };
      if (!parsed.data) throw new Error("Archivo invalido");
      for (const prefix of USER_DATA_PREFIXES) {
        const entry = Object.entries(parsed.data).find(([key]) => key.startsWith(`${prefix}:`));
        const targetKey = `${prefix}:${user.id}`;
        if (entry?.[1]) localStorage.setItem(targetKey, entry[1]);
      }
      setMessage(`Datos importados para ${user.displayName}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Administracion"
        description="Usuarios, permisos y acceso a la informacion de cada perfil."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" /> Usuario
          </Button>
        }
      />

      {(message || error) && (
        <p className={error ? "mb-3 text-sm text-red-500" : "mb-3 text-sm text-emerald-600 dark:text-emerald-400"}>
          {error || message}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {users.map((user) => {
          const summary = summaries.get(user.id) ?? getUserSummary(user.id);
          const isViewing = session.activeOwnerUserId === user.id;
          return (
            <Card key={user.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 truncate">
                      {user.role === "ADMIN" ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Shield className="h-4 w-4 text-muted-foreground" />}
                      {user.displayName}
                    </CardTitle>
                    <CardDescription>@{user.username}</CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={user.role === "ADMIN" ? "default" : "muted"}>{user.role === "ADMIN" ? "Admin" : "Usuario"}</Badge>
                    {user.lockedAt && <Badge variant="danger">Bloqueado</Badge>}
                    {isViewing && <Badge variant="success">Viendo</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{summary.incomes}</p>
                    <p className="text-[10px] text-muted-foreground">Ingresos</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{summary.expenses}</p>
                    <p className="text-[10px] text-muted-foreground">Gastos</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{summary.worklogs}</p>
                    <p className="text-[10px] text-muted-foreground">Horas</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{summary.loans}</p>
                    <p className="text-[10px] text-muted-foreground">Prestamos</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{summary.goals}</p>
                    <p className="text-[10px] text-muted-foreground">Metas</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{summary.notes}</p>
                    <p className="text-[10px] text-muted-foreground">Notas</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Creado {dayjs(user.createdAt).format("DD/MM/YYYY")}</span>
                  <span>
                    Ultima actividad: {summary.lastActivity ? dayjs(summary.lastActivity).format("DD/MM/YYYY") : "sin datos"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void switchOwner(user.id)} disabled={isViewing}>
                    <Eye className="h-3.5 w-3.5" /> Ver datos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportUser(user)}>
                    <Download className="h-3.5 w-3.5" /> Exportar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setImportingUser(user);
                      importInput.current?.click();
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" /> Importar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPasswordUser(user)}>
                    <KeyRound className="h-3.5 w-3.5" /> Contrasena
                  </Button>
                  <Button
                    size="sm"
                    variant={user.lockedAt ? "outline" : "ghost"}
                    onClick={() => void toggleLock(user)}
                    disabled={user.role === "ADMIN"}
                  >
                    {user.lockedAt ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {user.lockedAt ? "Desbloquear" : "Bloquear"}
                  </Button>
                  <Select
                    value={user.role}
                    onChange={(event) => void updateRole(user, event.target.value as UserRole)}
                    className="h-8 w-32 text-xs"
                  >
                    <option value="USER">Usuario</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <input
        ref={importInput}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && importingUser) void importUserData(file, importingUser);
          event.target.value = "";
        }}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Crear usuario" width="max-w-sm">
        <div className="space-y-3">
          <div>
            <Label>Usuario</Label>
            <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </div>
          <div>
            <Label>Nombre visible</Label>
            <Input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            />
          </div>
          <div>
            <Label>Contrasena inicial</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={!form.username.trim() || !form.password} onClick={() => void createNewUser()}>
            Crear
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={passwordUser !== null}
        onClose={() => {
          setPasswordUser(null);
          setPassword("");
        }}
        title={`Cambiar contrasena${passwordUser ? ` de ${passwordUser.displayName}` : ""}`}
        width="max-w-sm"
      >
        <div>
          <Label>Nueva contrasena</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setPasswordUser(null);
              setPassword("");
            }}
          >
            Cancelar
          </Button>
          <Button disabled={password.length < 4} onClick={() => void changePassword()}>
            Guardar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
