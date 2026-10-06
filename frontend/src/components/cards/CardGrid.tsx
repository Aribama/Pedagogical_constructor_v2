import { Plus } from "lucide-react";
import type { TechniqueCard } from "../../types/cards";
import "./CardTile.css";

type CardGridProps = {
  cards: TechniqueCard[];
  onOpen: (card: TechniqueCard) => void;
  onAdd?: (card: TechniqueCard) => void;
};

const bloomRu: Record<string, string> = {
  remember: "Запоминание",
  understand: "Понимание",
  apply: "Применение",
  analyze: "Анализ",
  evaluate: "Оценка",
  create: "Создание",
};

const auxTypeRu: Record<TechniqueCard["card_kind"], string> = {
  technique: "",
  aux_org: "Орг. момент",
  aux_team_split: "Деление на группы",
  aux_warmup: "Разминка",
  aux_reflection: "Рефлексия",
};

function getAgeText(c: TechniqueCard) {
  const parts: string[] = [];
  if (c.age_a1) parts.push("1-4");
  if (c.age_a2) parts.push("5-8");
  if (c.age_a3) parts.push("9-11");
  return parts.length ? `${parts.join(", ")} кл.` : "—";
}

function getBloomText(level: string) {
  const key = (level || "").toLowerCase();
  return bloomRu[key] ?? level ?? "—";
}

function isAuxCard(c: TechniqueCard) {
  return c.card_kind !== "technique";
}

// Цвет карточки: вспомогательные — белые, основные — по активности
function getCardVariant(c: TechniqueCard): "active" | "calm" | "aux" {
  if (isAuxCard(c)) return "aux";
  return c.activity_type === "active" ? "active" : "calm";
}

function getAuxLabel(c: TechniqueCard) {
  if (!isAuxCard(c)) return "";
  return auxTypeRu[c.card_kind] || "Вспомогательная";
}

function StageBar({ start, core, fin }: { start: boolean; core: boolean; fin: boolean }) {
  return (
    <div className="ct-stage" aria-label="Этап занятия">
      <div className="ct-stage__bar">
        <span className={start ? "is-on" : ""} title="Начало" />
        <span className={core ? "is-on" : ""} title="Середина" />
        <span className={fin ? "is-on" : ""} title="Окончание" />
      </div>
    </div>
  );
}

function Icons4KRow({
  critical,
  communication,
  collaboration,
  creative,
}: {
  critical: boolean;
  communication: boolean;
  collaboration: boolean;
  creative: boolean;
}) {
  const items = [
    { on: critical, icon: "❓", title: "Критическое мышление" },
    { on: communication, icon: "💬", title: "Коммуникация" },
    { on: collaboration, icon: "🤝", title: "Коллаборация" },
    { on: creative, icon: "💡", title: "Креативность" },
  ];

  return (
    <div className="ct-4k">
      {items.map((it) => (
        <span key={it.title} className={"ct-4k__cell" + (it.on ? " is-on" : "")} title={it.title}>
          {it.on ? it.icon : ""}
        </span>
      ))}
    </div>
  );
}

type CardTileProps = {
  card: TechniqueCard;
  onOpen?: (card: TechniqueCard) => void;
  onAdd?: (card: TechniqueCard) => void;
  className?: string;
};

export function CardTile({ card: c, onOpen, onAdd, className }: CardTileProps) {
  const variant = getCardVariant(c);
  const auxLabel = getAuxLabel(c);
  const workIcons = [c.work_individual ? "👤" : "", c.work_group ? "👥" : ""].filter(Boolean).join("");
  const interactive = !!onOpen;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onOpen(c) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onOpen(c);
            }
          : undefined
      }
      className={`ct ct--${variant}${interactive ? " ct--interactive" : ""}${className ? " " + className : ""}`}
    >
      {/* 1) Заголовок + бейдж для вспомогательных */}
      <div className="ct__head">
        <div className="ct__title" title={c.title}>
          {c.title}
        </div>
        {!!auxLabel && (
          <span className="ct__badge" title="Тип вспомогательной методики">
            {auxLabel}
          </span>
        )}
      </div>

      {/* 2) 4K иконки */}
      <Icons4KRow
        critical={c.k_critical}
        communication={c.k_communication}
        collaboration={c.k_collaboration}
        creative={c.k_creative}
      />

      {/* 3) Блум, длительность, формат, возраст */}
      <div className="ct__meta">
        <div className="ct__row">
          <span title="Уровень по Блуму">📈</span>
          <span>{getBloomText(c.bloom_level)}</span>
        </div>
        <div className="ct__row">
          <span title="Длительность">⏱</span>
          <span>
            <b>{c.duration_min}</b> мин.
            {workIcons ? (
              <span className="ct__work" title="Формат работы">
                {workIcons}
              </span>
            ) : null}
          </span>
        </div>
        <div className="ct__row">
          <span title="Возраст">📚</span>
          <span>{getAgeText(c)}</span>
        </div>
      </div>

      {onAdd ? (
        <button
          type="button"
          className="ct__add"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd(c);
          }}
          title="Добавить в сценарий"
          aria-label="Добавить в сценарий"
        >
          <Plus size={16} strokeWidth={2.6} />
        </button>
      ) : null}

      {/* 4) Этап занятия */}
      <StageBar start={c.stage_start} core={c.stage_core} fin={c.stage_final} />
    </div>
  );
}

export function CardGrid({ cards, onOpen, onAdd }: CardGridProps) {
  return (
    <div className="ct-grid">
      {cards.map((c) => (
        <CardTile key={c.id} card={c} onOpen={onOpen} onAdd={onAdd} />
      ))}
    </div>
  );
}

export default CardGrid;
