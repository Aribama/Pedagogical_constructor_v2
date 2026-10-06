import { Outlet } from "react-router-dom";
import { Logo } from "../../components/Header";
import "./AuthLayout.css";

export function AuthLayout() {
  return (
    <div className="lc-auth">
      <aside className="lc-auth__aside">
        <div className="lc-auth__aside-inner">
          <h2 className="lc-auth__claim">
            Соберите урок из проверенных приёмов, а&nbsp;ИИ поможет превратить его в&nbsp;план-конспект
          </h2>
          <div className="lc-auth__stack" aria-hidden="true">
            <div className="lc-auth__mini lc-auth__mini--pink">
              <b>Мозговой штурм</b>
              <span>💬 🤝 💡</span>
              <i />
            </div>
            <div className="lc-auth__mini lc-auth__mini--blue">
              <b>Кластер</b>
              <span>❓ · Анализ</span>
              <i />
            </div>
            <div className="lc-auth__mini lc-auth__mini--white">
              <b>Рефлексия «Светофор»</b>
              <span>💬 · Оценка</span>
              <i />
            </div>
          </div>
          <ul className="lc-auth__points">
            <li>Каталог приёмов с фильтрами по Блуму, навыкам 4К и этапам урока</li>
            <li>Сценарий с хронометражем и перетаскиванием</li>
            <li>Генерация плана занятия с помощью ИИ</li>
          </ul>
        </div>
      </aside>

      <main className="lc-auth__main">
        <div className="lc-auth__brand">
          <Logo />
        </div>
        <div className="lc-auth__card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
