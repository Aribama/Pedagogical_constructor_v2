import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http";
import type { ScenarioRead } from "../types/scenarios";

type Tab = "scenarios" | "cards";

function formatDateRu(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isCopyName(name?: string | null) {
  const s = (name ?? "").toLowerCase();
  return s.includes("(копия)");
}

export function CabinetPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("scenarios");

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const [scenarios, setScenarios] = useState<ScenarioRead[]>([]);

  const sorted = useMemo(() => {
    return (scenarios || []).slice().sort((a: any, b: any) => {
      const da = new Date(a.updated_at || a.created_at || 0).getTime();
      const db = new Date(b.updated_at || b.created_at || 0).getTime();
      return db - da;
    });
  }, [scenarios]);

  async function loadScenarios() {
    setLoading(true);
    setError("");
    try {
      const res = await http.get<ScenarioRead[]>("/scenarios/");
      setScenarios(res.data || []);
    } catch (e: any) {
      setError(e?.message ?? "Не удалось загрузить сценарии");
      setScenarios([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "scenarios") return;
    loadScenarios();
  }, [tab]);

  async function onDelete(id: number, name: string | null) {
    const ok = window.confirm(
      `Удалить сценарий “${name ?? "без названия"}”? Это действие нельзя отменить.`
    );
    if (!ok) return;

    setBusyId(id);
    setError("");
    try {
      await http.delete(`/scenarios/${id}/`);
      await loadScenarios();
    } catch (e: any) {
      setError(e?.message ?? "Не удалось удалить сценарий");
    } finally {
      setBusyId(null);
    }
  }

  async function onDuplicate(id: number) {
    setBusyId(id);
    setError("");
    try {
      const res = await http.post<ScenarioRead>(`/scenarios/${id}/duplicate/`, {});
      const created = res.data;
      await loadScenarios();
      if (created?.id) navigate(`/scenario/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Не удалось дублировать сценарий");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container lc-page" style={{ maxWidth: 1100 }}>
      <div className="lc-page-head">
        <div>
          <h1 className="lc-page-title">Личный кабинет</h1>
          <div className="lc-page-sub">Управление сценариями и карточками</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="lc-tabs mb-3">
        <button
          type="button"
          className={"lc-tabs__btn" + (tab === "scenarios" ? " is-active" : "")}
          onClick={() => setTab("scenarios")}
        >
          Мои сценарии
        </button>

        <button
          type="button"
          className={"lc-tabs__btn" + (tab === "cards" ? " is-active" : "")}
          onClick={() => setTab("cards")}
        >
          Мои карточки
        </button>
      </div>

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      {tab === "scenarios" ? (
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="fw-semibold">Сохранённые сценарии</div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => loadScenarios()}
                  disabled={loading}
                  title="Обновить список"
                >
                  Обновить
                </button>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => navigate("/scenario")}
                  title="Открыть черновик по умолчанию"
                >
                  Открыть черновик
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-muted small">Загрузка...</div>
            ) : sorted.length === 0 ? (
              <div className="text-muted small">
                У вас пока нет сохранённых сценариев. Создайте сценарий в каталоге и сохраните его с именем.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Название</th>
                      <th style={{ width: 210 }}>Создан</th>
                      <th style={{ width: 210 }}>Изменён</th>
                      <th style={{ width: 280 }} className="text-end">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="fw-semibold">{s.name ?? "—"}</div>

                            {isCopyName(s.name) ? (
                              <span className="badge text-bg-secondary" title="Это копия сценария">
                                копия
                              </span>
                            ) : null}
                          </div>

                          <div className="text-muted small">#{s.id}</div>
                        </td>

                        <td className="text-muted small">{formatDateRu(s.created_at)}</td>
                        <td className="text-muted small">{formatDateRu(s.updated_at)}</td>

                        <td className="text-end">
                          <div className="btn-group">
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => navigate(`/scenario/${s.id}`)}
                            >
                              Открыть
                            </button>

                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => onDuplicate(s.id)}
                              disabled={busyId === s.id}
                              title="Создать копию сценария"
                            >
                              {busyId === s.id ? "..." : "Дублировать"}
                            </button>

                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => onDelete(s.id, s.name)}
                              disabled={busyId === s.id}
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-muted small mt-2">
              Черновик по умолчанию не отображается в списке — он открывается кнопкой «Открыть черновик».
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="fw-semibold mb-2">Мои карточки</div>
            <div className="text-muted small">
              Раздел в разработке. Здесь будут: создание карточек, редактирование, отправка на модерацию.
            </div>

            <div className="mt-3">
              <button className="btn btn-outline-secondary" disabled>
                Добавить карточку (скоро)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CabinetPage;
