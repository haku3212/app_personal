import { useState } from "react";
import { LockKeyhole, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
  const { hasUsers, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(hasUsers ? "login" : "register");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await register({ username, displayName, password });
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {mode === "register" ? <UserPlus className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
          </div>
          <CardTitle>{mode === "register" ? "Crear usuario" : "Entrar"}</CardTitle>
          <CardDescription>
            {mode === "register"
              ? hasUsers
                ? "Cada usuario tendra su propia informacion."
                : "Crea un usuario normal. El admin se asigna desde una cuenta administradora."
              : "Ingresa con tu usuario para ver tus datos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Usuario</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          {mode === "register" && (
            <div>
              <Label>Nombre visible</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Contrasena</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button className="w-full" onClick={() => void submit()} disabled={busy}>
            {busy ? "Procesando..." : mode === "register" ? "Crear y entrar" : "Entrar"}
          </Button>
          {hasUsers && (
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => {
                setError("");
                setMode(mode === "register" ? "login" : "register");
              }}
            >
              {mode === "register" ? "Ya tengo usuario" : "Crear otro usuario"}
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
