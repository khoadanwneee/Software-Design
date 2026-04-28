import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { z } from "zod";
import { useAuth } from "./AuthProvider";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "student1@unihub.local", password: "password123" }
  });

  if (user) {
    return <Navigate to="/workshops" replace />;
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await login(values);
      navigate((location.state as { from?: string } | null)?.from ?? "/workshops", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={form.handleSubmit(onSubmit)}>
        <h1>UniHub Workshop</h1>
        <label>
          Email
          <input {...form.register("email")} autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" {...form.register("password")} autoComplete="current-password" />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit">
          <LogIn size={18} /> Login
        </button>
      </form>
    </main>
  );
}
