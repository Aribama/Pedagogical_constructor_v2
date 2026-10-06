"""
Офлайн-генератор план-конспекта без обращения к нейросети.

Собирает структурированный план из паспорта урока и выбранных карточек.
Используется, когда ключ DeepSeek не задан или выбран провайдер "local",
поэтому конструктор работает «из коробки», в том числе на демонстрации.
"""
from __future__ import annotations

from .base import GeneratePlanResult

STAGE_TITLES = {
    "начало": "Организационный момент и мотивация",
    "основная часть": "Основная часть",
    "завершение": "Закрепление и рефлексия",
}


def _stage_of(technique: dict) -> str:
    stages = technique.get("suitable_stages") or []
    kind = (technique.get("kind") or "").lower()
    if "рефлекс" in kind:
        return "завершение"
    if "оргмомент" in kind or "организац" in kind:
        return "начало"
    if "основная часть" in stages:
        return "основная часть"
    return stages[0] if stages else "основная часть"


def _short(text: str, limit: int = 600) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


def build_local_plan(lesson_input: dict) -> str:
    passport = lesson_input.get("passport") or {}
    techniques = sorted(lesson_input.get("techniques") or [], key=lambda t: t.get("position") or 0)
    timing = lesson_input.get("timing") or {}
    content = (lesson_input.get("subject_content") or "").strip()

    title = passport.get("lesson_topic") or passport.get("title") or "Урок"
    subject = passport.get("subject") or "не указан"
    grade = passport.get("grade")
    goal = passport.get("lesson_goal") or "не указана"
    total = int(timing.get("lesson_total_min") or passport.get("duration_min_total") or 45)

    lines: list[str] = [
        "## Паспорт урока",
        f"- Тема: {title}",
        f"- Предмет: {subject}",
        f"- Класс: {grade if grade else 'не указан'}",
        f"- Длительность: {total} мин",
        f"- Цель: {goal}",
    ]
    if passport.get("group_emotionality"):
        lines.append(f"- Состояние группы: {passport['group_emotionality']}")
    if passport.get("day_time"):
        lines.append(f"- Время проведения: {passport['day_time']}")
    if passport.get("group_size"):
        lines.append(f"- Учеников в группе: {passport['group_size']}")

    competencies = sorted({k for t in techniques for k in t.get("competencies_4k") or []})
    lines += ["", "## Задачи и планируемые результаты"]
    lines.append(f"- Предметные: {goal}.")
    if competencies:
        lines.append("- Метапредметные: развитие компетенций 4К — " + ", ".join(competencies) + ".")
    lines.append("- Личностные: учебная мотивация, умение работать по инструкции и оценивать свой результат.")

    if content:
        lines += ["", "## Содержание урока", _short(content, 1200)]

    lines += ["", "## Ход урока"]
    rows: list[tuple[str, str, int]] = []
    if not techniques:
        lines.append("Приёмы не выбраны. Добавьте карточки в сценарий, чтобы получить подробный ход урока.")
    else:
        # Порядок приёмов задаёт учитель, поэтому этапы идут блоками в этом порядке.
        blocks: list[tuple[str, list[dict]]] = []
        for t in techniques:
            stage = _stage_of(t)
            if blocks and blocks[-1][0] == stage:
                blocks[-1][1].append(t)
            else:
                blocks.append((stage, [t]))

        for stage, items in blocks:
            stage_min = sum(int(t.get("duration_min") or 0) for t in items)
            lines += ["", f"### {STAGE_TITLES[stage]} ({stage_min} мин)"]
            for t in items:
                minutes = int(t.get("duration_min") or 0)
                rows.append((STAGE_TITLES[stage], t.get("title") or "", minutes))
                meta = [x for x in [
                    t.get("activity_type"),
                    ", ".join(t.get("work_forms") or []) or None,
                    f"Блум: {t['bloom_level']}" if t.get("bloom_level") else None,
                ] if x]
                lines.append(f"**{t.get('title')}** — {minutes} мин" + (f" ({'; '.join(meta)})" if meta else ""))
                if t.get("description"):
                    lines.append(_short(t["description"]))
                lines.append("")

    used = sum(r[2] for r in rows)
    reserve = total - used
    lines += ["## Хронометраж", "| Этап | Приём | Минуты |", "|---|---|---|"]
    for stage, name, minutes in rows:
        lines.append(f"| {stage} | {name} | {minutes} |")
    if reserve > 0:
        lines.append(f"| Резерв | Подведение итогов, домашнее задание | {reserve} |")
    lines.append(f"| **Итого** | | **{max(total, used)}** |")
    if reserve < 0:
        lines += ["", f"Внимание: приёмы занимают {used} мин, это на {-reserve} мин больше длительности урока. "
                      "Сократите время отдельных приёмов или уберите один из них."]

    lines += [
        "",
        "## Рефлексия и домашнее задание",
        "- Попросите учеников коротко ответить: что получилось, что было трудно, что хочется узнать дальше.",
        "- Домашнее задание сформулируйте по итогам основной части урока.",
        "",
        "_План собран офлайн-генератором по выбранным карточкам. Для развёрнутого текста подключите DeepSeek (DEEPSEEK_API_KEY)._",
    ]
    return "\n".join(lines).strip() + "\n"


class DummyProvider:
    name = "local"

    def generate_plan(self, *, prompt: str, params: dict) -> GeneratePlanResult:
        text = build_local_plan(params.get("lesson_input") or {})
        return GeneratePlanResult(text=text, model="local-template", raw={"ok": True})
