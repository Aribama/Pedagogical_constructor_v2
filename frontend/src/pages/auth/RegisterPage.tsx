import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await register({ username, email, password });
      nav("/login");
    } catch (e: any) {
      const data = e?.response?.data;
      setErr(
        data?.username?.[0] ||
        data?.email?.[0] ||
        data?.detail ||
        "Не удалось зарегистрироваться"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="lc-auth__title">Создать аккаунт</h1>
      <div className="lc-auth__sub">Сохраняйте сценарии и добавляйте свои приёмы</div>
      <form onSubmit={onSubmit} className="d-grid gap-3">
        <div>
          <label className="form-label" htmlFor="username">Логин</label>
          <input
            id="username"
            className="form-control"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="form-control"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="password">Пароль</label>
          <input
            id="password"
            className="form-control"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {err && <div className="lc-auth__error">{err}</div>}

        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? "Создаём..." : "Создать аккаунт"}
        </button>
      </form>
      <div className="lc-auth__foot">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </div>
    </div>
  );
}
