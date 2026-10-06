import { Link, NavLink } from "react-router-dom";
import { BookOpen, Home, LayoutGrid, LogOut, UserRound } from "lucide-react";
import type { Me } from "../types/auth";
import "./Header.css";

type HeaderProps = {
  user?: Me | null;
  onLogout?: () => void;
};

const roleRu: Record<Me["role"], string> = {
  user: "Учитель",
  moderator: "Методист",
  admin: "Администратор",
};

const navItems = [
  { to: "/", label: "Главная", icon: Home, end: true },
  { to: "/catalog", label: "Каталог", icon: LayoutGrid },
  { to: "/wiki", label: "Вики", icon: BookOpen },
  { to: "/cabinet", label: "Мой кабинет", icon: UserRound },
];

export function Logo() {
  return (
    <Link to="/" className="lc-logo" aria-label="КОнструктор ЗАнятий — на главную">
      <span className="lc-logo__mark" aria-hidden="true">
        <span className="lc-logo__tile lc-logo__tile--pink" />
        <span className="lc-logo__tile lc-logo__tile--blue" />
        <span className="lc-logo__tile lc-logo__tile--white" />
        <span className="lc-logo__tile lc-logo__tile--indigo" />
      </span>
      <span className="lc-logo__text">
        <span className="lc-logo__name">
          <b>КО</b>нструктор <b>ЗА</b>нятий
        </span>
        <span className="lc-logo__sub">Сервис педагогического дизайна</span>
      </span>
    </Link>
  );
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="lc-header">
      <div className="container lc-header__inner" style={{ maxWidth: 1400 }}>
        <Logo />

        <nav className="lc-nav" aria-label="Основная навигация">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => "lc-nav__link" + (isActive ? " is-active" : "")}
            >
              <Icon size={16} strokeWidth={2.2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="lc-header__user">
          {user ? (
            <>
              <div className="lc-user" title={user.email || user.username}>
                <span className="lc-user__avatar">{user.username.slice(0, 1).toUpperCase()}</span>
                <span className="lc-user__meta">
                  <span className="lc-user__name">{user.username}</span>
                  <span className="lc-user__role">{roleRu[user.role] ?? user.role}</span>
                </span>
              </div>
              <button className="lc-icon-button" type="button" onClick={onLogout} title="Выйти">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline-secondary btn-sm">
                Войти
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm d-none d-sm-inline-block">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
