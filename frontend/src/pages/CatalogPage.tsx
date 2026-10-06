import { useEffect, useRef, useState } from "react";
import { listCards, type CardsQuery, type Logic } from "../api/cards";
import type { TechniqueCard } from "../types/cards";
import { FiltersPanel } from "../components/cards/FiltersPanel";
import { CardGrid } from "../components/cards/CardGrid";
import { CardModal } from "../components/cards/CardModal";
import { ScenarioBottomBar } from "../components/scenarios/ScenarioBottomBar";
import { useDebounce } from "../hooks/useDebounce";

type MethodType = "active" | "calm" | "aux";

function normalizeMethodTypeValue(v: string): MethodType | "passive" | null {
  const x = (v || "").trim().toLowerCase();
  if (x === "active") return "active";
  if (x === "calm") return "calm";
  if (x === "aux") return "aux";
  if (x === "passive") return "passive";
  return null;
}

function makeUiMethodTypes(selected: string[] | undefined): MethodType[] {
  const list = (selected ?? [])
    .map(normalizeMethodTypeValue)
    .filter(Boolean) as Array<MethodType | "passive">;

  return list.map((v) => (v === "passive" ? "calm" : v)) as MethodType[];
}

function cardMatchesMethodType(card: TechniqueCard, t: MethodType): boolean {
  if (t === "aux") return card.card_kind !== "technique";
  // active/calm — только для основных методик
  return card.card_kind === "technique" && card.activity_type === t;
}

function applyMethodTypeFilter(cards: TechniqueCard[], selected: MethodType[], logic: Logic): TechniqueCard[] {
  if (selected.length === 0) return cards;

  return cards.filter((card) => {
    const checks = selected.map((t) => cardMatchesMethodType(card, t));
    return logic === "all" ? checks.every(Boolean) : checks.some(Boolean);
  });
}

export function CatalogPage() {
  const [query, setQuery] = useState<CardsQuery>({
    mode: "simple",
    logic: "any",
    q: "",
    activity_type: [],
    bloom_levels: [],
    age_levels: [],
    work_format: [],
    skills_4k: [],
    lesson_stage: [],
    duration_max: undefined,
  });

  const debouncedQ = useDebounce(query.q || "", 350);

  const [cards, setCards] = useState<TechniqueCard[]>([]);
  const [totalAll, setTotalAll] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TechniqueCard | null>(null);

  const addRef = useRef<((cardId: number, title: string) => void) | null>(null);

  // 1️⃣ N — один раз
  useEffect(() => {
    (async () => {
      try {
        const baseQuery: CardsQuery = {
          mode: "simple",
          logic: "any",
          q: "",
          activity_type: [],
          bloom_levels: [],
          age_levels: [],
          work_format: [],
          skills_4k: [],
          lesson_stage: [],
          duration_max: undefined,
        };

        const allCards = await listCards(baseQuery);
        setTotalAll(allCards.length);
      } catch {
        setTotalAll(0);
      }
    })();
  }, []);

  // Логика для "Тип методики":
  // simple → query.logic
  // advanced → query.logic_activity (если задана)
  const methodTypeLogic: Logic =
    query.mode === "simple" ? (query.logic ?? "any") : (query.logic_activity ?? "any");

  // 2️⃣ M — запрос + локальная фильтрация "Тип методики"
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // UI выбранные типы (active/calm/aux)
        const uiSelected = makeUiMethodTypes(query.activity_type);

        const serverQuery: CardsQuery = {
          ...query,
          q: debouncedQ,
          activity_type: [],
        };

        const data = await listCards(serverQuery);

        const fixed = applyMethodTypeFilter(data, uiSelected, methodTypeLogic);
        setCards(fixed);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    debouncedQ,

    query.mode,
    query.logic,
    query.logic_activity,

    (query.activity_type || []).join(","),

    (query.bloom_levels || []).join(","),
    (query.age_levels || []).join(","),
    (query.work_format || []).join(","),
    (query.skills_4k || []).join(","),
    (query.lesson_stage || []).join(","),
    query.duration_max,
  ]);

  return (
    <div className="container lc-page" style={{ maxWidth: 1400, paddingBottom: 160 }}>
      <div className="lc-catalog">
        <aside className="lc-catalog__filters">
          <FiltersPanel query={query} onChange={(patch) => setQuery((q) => ({ ...q, ...patch }))} />
        </aside>

        <div className="lc-catalog__main">
          <div className="lc-page-head">
            <div>
              <h1 className="lc-page-title">Каталог приёмов</h1>
              <div className="lc-page-sub">
                Нажмите на карточку, чтобы прочитать описание, или «+», чтобы добавить приём в сценарий
              </div>
            </div>
            <span className="lc-pill">
              {loading ? "загрузка..." : `отобрано ${cards.length} из ${totalAll}`}
            </span>
          </div>

          {!loading && cards.length === 0 ? (
            <div className="lc-empty card">Под выбранные фильтры приёмов не нашлось. Попробуйте ослабить условия.</div>
          ) : (
            <CardGrid
              cards={cards}
              onOpen={(c) => setSelected(c)}
              onAdd={(c) => addRef.current?.(c.id, c.title)}
            />
          )}
        </div>
      </div>

      <CardModal
        card={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onAdd={() => {
          if (!selected) return;
          addRef.current?.(selected.id, selected.title);
          setSelected(null);
        }}
      />

      <ScenarioBottomBar requestAddCardRef={addRef} />
    </div>
  );
}
