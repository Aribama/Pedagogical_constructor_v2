import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  autosaveScenarioItems,
  deleteScenario,
  getDefaultScenario,
  getScenario,
  saveScenarioAs,
  updateScenario,
} from "../api/scenarios";

import { getCard } from "../api/cards";
import { generatePlan } from "../api/ai";

import type { TechniqueCard } from "../types/cards";
import type {
  ScenarioRead,
  ScenarioPatch,
  ScenarioItemRead,
  ScenarioItemPatch,
  DayTime,
  AiMode,
} from "../types/scenarios";

import { CardModal } from "../components/cards/CardModal";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ItemUI = ScenarioItemRead & {
  card?: TechniqueCard | null;
};

const GROUP_PROFILE_TEMPLATE = `Описание учебной группы:
- Уровень эмоциональной активности: (низкий/средний/высокий)
- Уровень мотивации: (низкий/средний/высокий)
- Уровень базовой подготовки: (слабый/средний/сильный)
- Особые условия: (инклюзия, речевые трудности, высокая утомляемость и т.д.)
- Время занятия: (начало/середина/конец дня)
`;

function formatDateRu(iso?: string) {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    return dt.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function normText(s: string) {
  return (s ?? "").replace(/\r\n/g, "\n");
}

function normalizeItems(items?: ScenarioItemRead[] | null): ItemUI[] {
  return (items ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((it) => ({ ...it, card: (it as any).card ?? null }));
}

function clampDayTime(v: any): DayTime {
  if (v === "begin" || v === "middle" || v === "end") return v;
  return "middle";
}

const EMOTIONALITY_OPTIONS: { value: string; label: string }[] = [
  { value: "calm", label: "Спокойная и собранная" },
  { value: "moderate", label: "Умеренно активная" },
  { value: "very_active", label: "Очень активная и энергичная" },
  { value: "tires_fast", label: "Быстро утомляемая" },
  { value: "anxious", label: "Тревожная / неуверенная" },
  { value: "disconnected", label: "Разобщённая / требует вовлечения" },
];

const CARD_KIND_BADGES: Record<string, { label: string; cls: string }> = {
  aux_team_split: { label: "Группы", cls: "text-bg-warning" },
  aux_warmup: { label: "Разминка", cls: "text-bg-info" },
  aux_org: { label: "Оргмомент", cls: "text-bg-light" },
  aux_reflection: { label: "Рефлексия", cls: "text-bg-secondary" },
};

function itemDuration(it: ScenarioItemRead): number {
  return Number(it.custom_duration_min ?? it.duration_min ?? 0);
}

function durationLabel(min?: number) {
  const m = Number(min ?? 0);
  if (!m) return "—";
  return `${m} мин`;
}

function SortableRow({
  item,
  onRemove,
  onOpenCard,
}: {
  item: ItemUI;
  onRemove: (id: number) => void;
  onOpenCard: (cardId: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(item.id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: "#fff",
  };

  const cardTitle = item.card?.title ?? item.title ?? `Карточка #${item.technique_card}`;
  const dur = itemDuration(item);
  const kindBadge = item.card_kind ? CARD_KIND_BADGES[item.card_kind] : undefined;

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 44 }}>
        <span
          {...attributes}
          {...listeners}
          style={{
            display: "inline-block",
            cursor: "grab",
            padding: "2px 8px",
            borderRadius: 6,
            background: "#f1f3f5",
            userSelect: "none",
          }}
          title="Перетащить"
        >
          ☰
        </span>
      </td>
      <td>
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-link p-0"
            style={{ textDecoration: "none" }}
            onClick={() => onOpenCard(item.technique_card)}
            title="Открыть карточку"
          >
            {cardTitle}
          </button>
          {kindBadge ? <span className={`badge ${kindBadge.cls}`}>{kindBadge.label}</span> : null}
        </div>
      </td>
      <td style={{ width: 120 }}>
        <span className="text-muted">{durationLabel(dur)}</span>
      </td>
      <td style={{ width: 140 }}>
        <span className="text-muted">{item.stage_label || "—"}</span>
      </td>
      <td style={{ width: 120, textAlign: "right" }}>
        <button
          className="btn btn-sm btn-outline-danger"
          onClick={() => onRemove(item.id)}
          title="Удалить из сценария"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function ScenarioPage() {
  const navigate = useNavigate();
  const params = useParams();
  const scenarioId = Number(params.id ?? 0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [scenario, setScenario] = useState<ScenarioRead | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftTheme, setDraftTheme] = useState("");

  const [draftProfile, setDraftProfile] = useState<{
    grade: number | null;
    subject: string;
    goal: string;
    emotionality: string;
    day_time: DayTime;
    group_size: number;
    duration_min: number;
    teacher_notes: string;
  }>({
    grade: 5,
    subject: "",
    goal: "",
    emotionality: "moderate",
    day_time: "middle",
    group_size: 0,
    duration_min: 45,
    teacher_notes: "",
  });

  const [draftSubjectContent, setDraftSubjectContent] = useState("");
  const [draftPlan, setDraftPlan] = useState("");
  const [draftAiMode, setDraftAiMode] = useState<AiMode>("balanced");

  const [draftItems, setDraftItems] = useState<ItemUI[]>([]);
  const [dirty, setDirty] = useState(false);

  const [selectedCard, setSelectedCard] = useState<TechniqueCard | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const s = scenarioId
          ? await getScenario(scenarioId)
          : await getDefaultScenario();

        if (cancelled) return;
        setScenario(s);

        setDraftTitle(normText(s.name ?? s.title ?? ""));
        setDraftTheme(normText(s.note ?? ""));

        setDraftProfile({
          grade: s.grade ?? null,
          subject: normText((s as any).subject ?? ""),
          goal: normText((s as any).goal ?? ""),
          emotionality: s.emotionality || "moderate",
          day_time: clampDayTime((s as any).day_time),
          group_size: Number((s as any).group_size ?? 0),
          duration_min: Number((s as any).duration_min ?? 45),
          teacher_notes: normText((s as any).teacher_notes ?? ""),
        });

        setDraftSubjectContent(normText((s as any).subject_content ?? ""));
        setDraftPlan(normText((s as any).plan_text ?? ""));
        setDraftAiMode((s.ai_mode as AiMode) || "balanced");

        setDraftItems(normalizeItems((s as any).items));
        setDirty(false);
      } catch (e: any) {
        setError(e?.message ?? "Не удалось загрузить сценарий");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  const totalMinutes = useMemo(() => {
    return draftItems.reduce((acc, it) => acc + itemDuration(it), 0);
  }, [draftItems]);

  const toPatch = (): ScenarioPatch => {
    const patch: ScenarioPatch = {
      name: draftTitle,
      // «Тема урока» хранится в поле note сценария
      note: draftTheme,

      grade: draftProfile.grade,
      subject: draftProfile.subject,
      goal: draftProfile.goal,
      emotionality: draftProfile.emotionality,
      day_time: draftProfile.day_time,
      group_size: draftProfile.group_size,
      duration_min: draftProfile.duration_min,
      teacher_notes: draftProfile.teacher_notes,

      subject_content: draftSubjectContent,
      plan_text: draftPlan,
      ai_mode: draftAiMode,
    };
    return patch;
  };

  async function persistDraft(baseScenario: ScenarioRead): Promise<ScenarioRead> {
    // Важно: PATCH-сериализатор на backend может возвращать только обновлённые поля
    // поэтому мерджим с baseScenario
    const patch = toPatch();
    const updated = await updateScenario(baseScenario.id, patch);
    return { ...baseScenario, ...updated } as any;
  }

  async function saveAll(base: ScenarioRead) {
    const merged = await persistDraft(base);
    setScenario(merged);

    const payloadItems: ScenarioItemPatch[] = draftItems.map((it, idx) => ({
      technique_card: it.technique_card,
      position: idx + 1,
      custom_duration_min: it.custom_duration_min ?? null,
    }));
    await autosaveScenarioItems(base.id, payloadItems);
    setDirty(false);
  }

  async function onSave() {
    if (!scenario) return;
    setBusy(true);
    setError("");
    try {
      await saveAll(scenario);
    } catch (e: any) {
      setError(e?.message ?? "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveAs() {
    if (!scenario) return;
    setBusy(true);
    setError("");
    try {
      const title = prompt("Название копии сценария:", `${draftTitle || "Сценарий"} (копия)`);
      if (!title) return;

      const created = await saveScenarioAs(scenario.id, title);
      navigate(`/scenario/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Не удалось сохранить копию");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!scenario) return;
    if (!confirm("Удалить сценарий?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteScenario(scenario.id);
      navigate("/cabinet");
    } catch (e: any) {
      setError(e?.message ?? "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  async function onOpenCard(cardId: number) {
    setBusy(true);
    setError("");
    try {
      const c = await getCard(cardId);
      setSelectedCard(c);
    } catch (e: any) {
      setError(e?.message ?? "Не удалось загрузить карточку");
    } finally {
      setBusy(false);
    }
  }

  function onRemoveItem(itemId: number) {
    setDraftItems((arr) => arr.filter((it) => it.id !== itemId).map((it, idx) => ({ ...it, position: idx + 1 })));
    setDirty(true);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = draftItems.findIndex((it) => String(it.id) === active.id);
    const newIndex = draftItems.findIndex((it) => String(it.id) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(draftItems, oldIndex, newIndex).map((it, idx) => ({
      ...it,
      position: idx + 1,
    }));
    setDraftItems(next);
    setDirty(true);
  }

  async function onGeneratePlan() {
    if (!scenario) return;
    setBusy(true);
    setError("");
    try {
      // Генерация идёт по сохранённым данным, поэтому сначала сохраняем черновик.
      if (dirty) await saveAll(scenario);
      const res: any = await generatePlan({ scenario_id: scenario.id } as any);
      const planText = res?.data?.plan_text ?? res?.plan_text ?? "";
      setDraftPlan(normText(planText));
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        e?.message ||
        "Не удалось сгенерировать план";
      setError(detail);
    } finally {
      setBusy(false);
    }
  }

  function onInsertGroupTemplate() {
    setDraftProfile((p) => {
      const current = normText(p.teacher_notes ?? "");
      const next = current ? `${current}\n\n${GROUP_PROFILE_TEMPLATE}` : GROUP_PROFILE_TEMPLATE;
      return { ...p, teacher_notes: next };
    });
    setDirty(true);
  }

  if (loading) return <div className="container">Загрузка...</div>;

  if (!scenario) {
    return (
      <div className="container">
        <div className="alert alert-warning">Сценарий не найден</div>
        <button className="btn btn-secondary" onClick={() => navigate("/catalog")}>В каталог</button>
      </div>
    );
  }

  const createdAt = (scenario as any).created_at;
  const updatedAt = (scenario as any).updated_at;

  return (
    <div className="container lc-page" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h1 className="lc-page-title mb-1">Сценарий занятия</h1>
          <div className="text-muted small lh-sm">
            <div>
              Создан: <b>{formatDateRu(createdAt)}</b>
            </div>
            <div>
              Последнее редактирование: <b>{formatDateRu(updatedAt)}</b>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary" onClick={() => navigate("/cabinet")} disabled={busy}>
            ← В кабинет
          </button>

          <button className="btn btn-outline-primary" onClick={onSaveAs} disabled={busy}>
            Сохранить как…
          </button>

          <button className="btn btn-primary" onClick={onSave} disabled={busy || !dirty}>
            {busy ? "Сохранение…" : dirty ? "Сохранить" : "Сохранено"}
          </button>

          <button className="btn btn-outline-danger" onClick={onDelete} disabled={busy}>
            Удалить
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      ) : null}

      <hr className="my-3" />

      <div className="row g-3">
        {/* Left column */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title mb-3">Паспорт занятия</h5>

              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">Название сценария</label>
                  <input
                    className="form-control"
                    value={draftTitle}
                    onChange={(e) => {
                      setDraftTitle(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Тема урока</label>
                  <input
                    className="form-control"
                    value={draftTheme}
                    onChange={(e) => {
                      setDraftTheme(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label">Класс</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={11}
                    value={draftProfile.grade ?? ""}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, grade: e.target.value ? Number(e.target.value) : null }));
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="col-12 col-md-8">
                  <label className="form-label">Предмет</label>
                  <input
                    className="form-control"
                    value={draftProfile.subject}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, subject: e.target.value }));
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Цель занятия</label>
                  <input
                    className="form-control"
                    value={draftProfile.goal}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, goal: e.target.value }));
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Состояние группы</label>
                  <select
                    className="form-select"
                    value={draftProfile.emotionality}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, emotionality: e.target.value }));
                      setDirty(true);
                    }}
                  >
                    {EMOTIONALITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Время дня</label>
                  <select
                    className="form-select"
                    value={draftProfile.day_time}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, day_time: e.target.value as any }));
                      setDirty(true);
                    }}
                  >
                    <option value="begin">Начало</option>
                    <option value="middle">Середина</option>
                    <option value="end">Конец</option>
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Размер группы</label>
                  <input
                    type="number"
                    className="form-control"
                    value={draftProfile.group_size}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, group_size: Number(e.target.value || 0) }));
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Длительность (мин)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={draftProfile.duration_min}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, duration_min: Number(e.target.value || 0) }));
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label mb-0">Примечания учителя / профиль группы</label>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      onClick={onInsertGroupTemplate}
                      disabled={busy}
                    >
                      Вставить шаблон
                    </button>
                  </div>
                  <textarea
                    className="form-control mt-2"
                    style={{ minHeight: 180 }}
                    value={draftProfile.teacher_notes}
                    onChange={(e) => {
                      setDraftProfile((p) => ({ ...p, teacher_notes: normText(e.target.value) }));
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm mt-3">
            <div className="card-body">
              <h5 className="card-title mb-3">Предметная составляющая</h5>
              <textarea
                className="form-control"
                style={{ minHeight: 220 }}
                value={draftSubjectContent}
                onChange={(e) => {
                  setDraftSubjectContent(normText(e.target.value));
                  setDirty(true);
                }}
                placeholder="Текст/материалы урока (опционально)"
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h5 className="card-title mb-0">Последовательность приёмов</h5>
                <div className="text-muted small">
                  Итого: <b>{totalMinutes}</b> мин
                </div>
              </div>

              <div className="table-responsive mt-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={draftItems.map((it) => String(it.id))} strategy={verticalListSortingStrategy}>
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th style={{ width: 44 }} />
                          <th>Приём</th>
                          <th style={{ width: 120 }}>Время</th>
                          <th style={{ width: 140 }}>Этап</th>
                          <th style={{ width: 120 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {draftItems.length ? (
                          draftItems.map((it) => (
                            <SortableRow
                              key={it.id}
                              item={it}
                              onRemove={onRemoveItem}
                              onOpenCard={onOpenCard}
                            />
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-muted">
                              Приёмы не добавлены
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

          <div className="card shadow-sm mt-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h5 className="card-title mb-0">План-конспект</h5>
                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={draftAiMode}
                    title="Насколько свободно ИИ может менять выбранные приёмы"
                    onChange={(e) => {
                      setDraftAiMode(e.target.value as AiMode);
                      setDirty(true);
                    }}
                  >
                    <option value="strict">Строго по карточкам</option>
                    <option value="balanced">Сбалансированно</option>
                    <option value="free">Свободно</option>
                  </select>
                  <button className="btn btn-outline-success" onClick={onGeneratePlan} disabled={busy}>
                    {busy ? "Генерация…" : "Сгенерировать план"}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <textarea
                  className="form-control"
                  style={{ minHeight: 200 }}
                  value={draftPlan}
                  placeholder="План занятия (можно сгенерировать)"
                  onChange={(e) => {
                    setDraftPlan(normText(e.target.value));
                    setDirty(true);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модалка карточки */}
      {selectedCard ? (
        <CardModal
          card={selectedCard}
          open={true}
          onClose={() => setSelectedCard(null)}
        />
      ) : null}
    </div>
  );
}
