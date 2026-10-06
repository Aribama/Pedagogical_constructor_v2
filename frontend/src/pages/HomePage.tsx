import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  PenLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../app/providers/AuthProvider";
import { listCards } from "../api/cards";
import type { TechniqueCard } from "../types/cards";
import { CardTile } from "../components/cards/CardGrid";
import { Logo } from "../components/Header";
import "./HomePage.css";

// Карточки-примеры: показываются, пока каталог не загрузился (или если он пуст)
const base: Omit<TechniqueCard, "id" | "title"> = {
  description_html: "",
  duration_min: 10,
  status: "public",
  activity_type: "active",
  bloom_level: "create",
  age_a1: false, age_a2: true, age_a3: true,
  work_individual: false, work_group: true,
  k_critical: false, k_creative: false, k_communication: false, k_collaboration: false,
  stage_start: false, stage_core: true, stage_final: false,
  card_kind: "technique",
};

const SAMPLE_CARDS: TechniqueCard[] = [
  {
    ...base, id: -1, title: "Мозговой штурм", duration_min: 8,
    k_communication: true, k_collaboration: true, k_creative: true,
    stage_start: true, stage_core: true,
  },
  {
    ...base, id: -2, title: "Кластер", activity_type: "calm", bloom_level: "analyze",
    work_individual: true, k_critical: true,
  },
  {
    ...base, id: -3, title: "Рефлексия «Светофор»", card_kind: "aux_reflection", activity_type: "calm",
    bloom_level: "evaluate", duration_min: 3, k_communication: true, age_a1: true,
    stage_core: false, stage_final: true,
  },
];

function count4k(c: TechniqueCard) {
  return [c.k_critical, c.k_communication, c.k_collaboration, c.k_creative].filter(Boolean).length;
}

// Для витрины берём по одной живой карточке каждого цвета — самую «насыщенную» по навыкам 4К
function pickHeroCards(cards: TechniqueCard[]): TechniqueCard[] {
  const best = (list: TechniqueCard[]) =>
    list.slice().sort((x, y) => count4k(y) - count4k(x))[0];
  const active = best(cards.filter((c) => c.card_kind === "technique" && c.activity_type === "active"));
  const calm = best(cards.filter((c) => c.card_kind === "technique" && c.activity_type === "calm"));
  const aux = best(cards.filter((c) => c.card_kind !== "technique"));
  return active && calm && aux ? [active, calm, aux] : SAMPLE_CARDS;
}

const steps = [
  {
    icon: SlidersHorizontal,
    title: "Подберите приёмы",
    text: "Фильтруйте каталог по возрасту, этапу урока, уровню таксономии Блума, навыкам 4К и длительности.",
  },
  {
    icon: Layers,
    title: "Соберите сценарий",
    text: "Добавляйте карточки одним кликом, меняйте порядок перетаскиванием и следите за хронометражем.",
  },
  {
    icon: PenLine,
    title: "Опишите урок",
    text: "Заполните паспорт: предмет, класс, цель, состояние группы, время дня и материалы занятия.",
  },
  {
    icon: Sparkles,
    title: "Получите план-конспект",
    text: "ИИ встроит выбранные приёмы в канву урока и распишет этапы, задачи и тайминг.",
  },
];

const agents = [
  {
    icon: Search,
    role: "Аналитик",
    text: "Изучает паспорт урока и формулирует задачи и планируемые результаты в духе ФГОС.",
  },
  {
    icon: GraduationCap,
    role: "Методист",
    text: "Раскладывает приёмы по этапам и показывает, как применить каждый на материале урока.",
  },
  {
    icon: Timer,
    role: "Хронометрист",
    text: "Сводит тайминг к длительности занятия и чередует активную и спокойную работу.",
  },
  {
    icon: FileText,
    role: "Редактор",
    text: "Собирает конкретный и логичный текст, готовый к использованию на уроке.",
  },
];

const audience = [
  {
    icon: UsersRound,
    title: "Учителям",
    text: "Быстро находить подходящие приёмы и готовить разнообразные уроки без многочасового поиска по методичкам.",
  },
  {
    icon: ShieldCheck,
    title: "Методистам",
    text: "Пополнять базу приёмов, проверять карточки коллег и держать каталог в порядке через модерацию.",
  },
  {
    icon: GraduationCap,
    title: "Молодым педагогам",
    text: "Опираться на проверенные механики и видеть, как приём работает на конкретном этапе урока.",
  },
];

export function HomePage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<TechniqueCard[] | null>(null);

  useEffect(() => {
    listCards({ mode: "simple", logic: "any" })
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

  const heroCards = cards && cards.length ? pickHeroCards(cards) : SAMPLE_CARDS;
  const legendCard = heroCards[0];
  const cardsCount = cards?.length ?? 0;

  const primaryCta = user
    ? { to: "/catalog", label: "Открыть каталог" }
    : { to: "/register", label: "Начать работу" };
  const secondaryCta = user
    ? { to: "/cabinet", label: "Мои сценарии" }
    : { to: "/login", label: "Войти" };

  return (
    <div className="home">
      {/* ===== HERO ===== */}
      <section className="home-hero">
        <div className="home-hero__blob home-hero__blob--pink" />
        <div className="home-hero__blob home-hero__blob--blue" />

        <div className="container home-hero__inner" style={{ maxWidth: 1240 }}>
          <div className="home-hero__copy">
            <span className="home-eyebrow">
              <Sparkles size={14} /> Педагогический дизайн с поддержкой ИИ
            </span>
            <h1 className="home-hero__title">
              От проверенного приёма — <span className="home-gradient-text">к готовому плану урока</span>
            </h1>
            <p className="home-hero__lead">
              Цифровой конструктор помогает учителю подобрать методические приёмы под задачи занятия,
              собрать из них сценарий с хронометражем и получить подробный план-конспект,
              адаптированный к теме и классу.
            </p>
            <div className="home-hero__cta">
              <Link to={primaryCta.to} className="btn btn-gradient btn-lg">
                {primaryCta.label} <ArrowRight size={18} className="ms-1" />
              </Link>
              <Link to={secondaryCta.to} className="btn btn-outline-secondary btn-lg">
                {secondaryCta.label}
              </Link>
            </div>

            <div className="home-stats">
              <div className="home-stat">
                <b>{cardsCount > 0 ? cardsCount : "—"}</b>
                <span>приёмов в каталоге</span>
              </div>
              <div className="home-stat">
                <b>6</b>
                <span>уровней по Блуму</span>
              </div>
              <div className="home-stat">
                <b>4</b>
                <span>навыка 4К</span>
              </div>
              <div className="home-stat">
                <b>3</b>
                <span>этапа урока</span>
              </div>
            </div>
          </div>

          <div className="home-hero__visual" aria-hidden="true">
            <div className="home-fan">
              {heroCards.map((c, i) => (
                <div key={c.id} className={`home-fan__item home-fan__item--${i}`}>
                  <CardTile card={c} />
                </div>
              ))}
            </div>

            <div className="home-float home-float--scenario">
              <div className="home-float__head">
                <Layers size={15} /> Сценарий занятия
                <span className="home-float__chip">
                  <Clock size={12} /> 45 мин
                </span>
              </div>
              <div className="home-timeline">
                <span className="home-timeline__seg home-timeline__seg--aux" style={{ flex: 3 }} />
                <span className="home-timeline__seg home-timeline__seg--active" style={{ flex: 8 }} />
                <span className="home-timeline__seg home-timeline__seg--calm" style={{ flex: 10 }} />
                <span className="home-timeline__seg home-timeline__seg--active" style={{ flex: 15 }} />
                <span className="home-timeline__seg home-timeline__seg--aux" style={{ flex: 3 }} />
              </div>
            </div>

            <div className="home-float home-float--ai">
              <span className="home-float__ai-icon">
                <Sparkles size={16} />
              </span>
              <div>
                <b>План-конспект готов</b>
                <div className="home-float__muted">5 этапов · задачи по ФГОС</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== КАК ЭТО РАБОТАЕТ ===== */}
      <section className="home-section">
        <div className="container" style={{ maxWidth: 1240 }}>
          <div className="home-section__head">
            <span className="home-kicker">Как это работает</span>
            <h2>Четыре шага от идеи до занятия</h2>
            <p>Учитель управляет каждым шагом: конструктор подсказывает, но не решает за педагога.</p>
          </div>

          <div className="home-steps">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="home-step">
                <div className="home-step__top">
                  <span className="home-step__icon">
                    <Icon size={20} />
                  </span>
                  <span className="home-step__num">0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== КАК ЧИТАТЬ КАРТОЧКУ ===== */}
      <section className="home-section home-section--tinted">
        <div className="container" style={{ maxWidth: 1240 }}>
          <div className="home-legend">
            <div className="home-legend__card">
              <div className="home-legend__card-wrap">
                <CardTile card={legendCard} />
              </div>
              <div className="home-legend__swatches">
                <span><i className="sw sw--active" /> Активный приём</span>
                <span><i className="sw sw--calm" /> Спокойный приём</span>
                <span><i className="sw sw--aux" /> Вспомогательный</span>
              </div>
            </div>

            <div className="home-legend__copy">
              <span className="home-kicker">Карточка приёма</span>
              <h2>Вся методика — на одной карточке</h2>
              <p className="home-legend__lead">
                Каждый приём описан по единой схеме, поэтому их легко сравнивать и комбинировать.
                Цвет сразу показывает характер деятельности, чтобы урок не превращался в сплошную
                лекцию или нон-стоп активность.
              </p>
              <ul className="home-legend__list">
                <li>
                  <span className="home-legend__icon">❓💬🤝💡</span>
                  <div>
                    <b>Навыки 4К</b>
                    <span>критическое мышление, коммуникация, коллаборация, креативность</span>
                  </div>
                </li>
                <li>
                  <span className="home-legend__icon">📈</span>
                  <div>
                    <b>Уровень по таксономии Блума</b>
                    <span>от запоминания до создания</span>
                  </div>
                </li>
                <li>
                  <span className="home-legend__icon">⏱ 👤👥</span>
                  <div>
                    <b>Длительность и формат</b>
                    <span>индивидуальная или групповая работа</span>
                  </div>
                </li>
                <li>
                  <span className="home-legend__icon">📚</span>
                  <div>
                    <b>Возраст</b>
                    <span>1–4, 5–8 или 9–11 классы</span>
                  </div>
                </li>
                <li>
                  <span className="home-legend__icon home-legend__icon--bar">
                    <i className="on" />
                    <i className="on" />
                    <i />
                  </span>
                  <div>
                    <b>Этап занятия</b>
                    <span>начало, середина или завершение урока</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ИИ-КОМАНДА ===== */}
      <section className="home-section">
        <div className="container" style={{ maxWidth: 1240 }}>
          <div className="home-section__head">
            <span className="home-kicker">Генерация плана</span>
            <h2>Четыре ИИ-эксперта работают как конвейер</h2>
            <p>
              Приёмы не просто перечисляются, а встраиваются в предметное содержание урока
              с учётом класса, цели и состояния группы.
            </p>
          </div>

          <div className="home-agents">
            {agents.map(({ icon: Icon, role, text }, i) => (
              <div key={role} className="home-agent">
                <span className={`home-agent__icon home-agent__icon--${i}`}>
                  <Icon size={20} />
                </span>
                <h3>{role}</h3>
                <p>{text}</p>
                {i < agents.length - 1 && (
                  <span className="home-agent__arrow" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="home-modes">
            <span className="home-modes__label">
              <ListChecks size={16} /> Режимы генерации:
            </span>
            <span className="home-mode">Строго по карточкам</span>
            <span className="home-mode home-mode--on">Сбалансированно</span>
            <span className="home-mode">Свободно</span>
          </div>
        </div>
      </section>

      {/* ===== ДЛЯ КОГО ===== */}
      <section className="home-section home-section--tight">
        <div className="container" style={{ maxWidth: 1240 }}>
          <div className="home-section__head">
            <span className="home-kicker">Для кого</span>
            <h2>Сервис для всего педагогического коллектива</h2>
          </div>
          <div className="home-audience">
            {audience.map(({ icon: Icon, title, text }) => (
              <div key={title} className="home-aud">
                <span className="home-aud__icon">
                  <Icon size={20} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="home-section home-section--tight">
        <div className="container" style={{ maxWidth: 1240 }}>
          <div className="home-cta">
            <div>
              <h2>Соберите своё первое занятие</h2>
              <p>Откройте каталог, добавьте несколько приёмов в сценарий и сгенерируйте план-конспект.</p>
            </div>
            <Link to={user ? "/catalog" : "/register"} className="btn btn-light btn-lg home-cta__btn">
              {user ? "Перейти в каталог" : "Создать аккаунт"} <ArrowRight size={18} className="ms-1" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="container home-footer__inner" style={{ maxWidth: 1240 }}>
          <Logo />
          <span className="home-footer__note">
            Цифровой педагогический конструктор · {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
