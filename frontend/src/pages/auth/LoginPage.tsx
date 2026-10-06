import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;

  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login({ login: loginValue, password });
      nav(loc.state?.from || "/catalog");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="lc-auth__title">С возвращением 👋</h1>
      <div className="lc-auth__sub">Войдите, чтобы продолжить работу над занятиями</div>
      <form onSubmit={onSubmit} className="d-grid gap-3">
        <div>
          <label className="form-label" htmlFor="login">Логин или email</label>
          <input
            id="login"
            className="form-control"
            autoComplete="username"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="password">Пароль</label>
          <input
            id="password"
            className="form-control"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {err && <div className="lc-auth__error">{err}</div>}

        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? "Входим..." : "Войти"}
        </button>
      </form>
      <div className="lc-auth__foot">
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </div>
    </div>
  );
}
