# backend/ai/prompts.py
from __future__ import annotations

import html
import re
from typing import Any, Dict, Iterable

_TAG_RE = re.compile(r"<[^>]+>")
_BLOCK_TAG_RE = re.compile(r"</?(p|div|br|li|h[1-6]|tr|ul|ol|blockquote)[^>]*>", re.IGNORECASE)
_SPACES_RE = re.compile(r"[ \t]+")
_NEWLINES_RE = re.compile(r"\n{3,}")


def html_to_text(value: str) -> str:
    """Превращает HTML описания карточки в читаемый текст для модели."""
    if not value:
        return ""
    text = _BLOCK_TAG_RE.sub("\n", value)
    text = _TAG_RE.sub("", text)
    text = html.unescape(text)
    text = _SPACES_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    return _NEWLINES_RE.sub("\n\n", text).strip()


def _label(obj: Any, field: str) -> str:
    """Человекочитаемое значение поля с choices (get_FOO_display), иначе само значение."""
    getter = getattr(obj, f"get_{field}_display", None)
    if callable(getter):
        return str(getter() or "")
    return str(getattr(obj, field, "") or "")


def _stages(card: Any) -> list[str]:
    names = []
    if getattr(card, "stage_start", False):
        names.append("начало")
    if getattr(card, "stage_core", False):
        names.append("основная часть")
    if getattr(card, "stage_final", False):
        names.append("завершение")
    return names


def _competencies(card: Any) -> list[str]:
    mapping = [
        ("k_critical", "критическое мышление"),
        ("k_creative", "креативность"),
        ("k_communication", "коммуникация"),
        ("k_collaboration", "кооперация"),
    ]
    return [title for field, title in mapping if getattr(card, field, False)]


def _work_forms(card: Any) -> list[str]:
    forms = []
    if getattr(card, "work_individual", False):
        forms.append("индивидуальная")
    if getattr(card, "work_group", False):
        forms.append("групповая")
    return forms


def build_lesson_input(
    *,
    scenario,
    items: Iterable[Any],
    cards_by_id: Dict[int, Any],
    extra_params: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Собирает данные урока для модели:
      passport         — общая информация о занятии и группе;
      techniques       — выбранные приёмы в порядке сценария;
      subject_content  — предметное содержание урока от учителя;
      timing           — суммарное время приёмов и запас относительно длительности урока.
    """
    extra_params = extra_params or {}

    passport = {
        "title": scenario.name or "",
        "lesson_topic": scenario.note or "",
        "subject": scenario.subject or "",
        "grade": scenario.grade,
        "lesson_goal": scenario.goal or "",
        "duration_min_total": scenario.duration_min,
        "group_size": scenario.group_size or None,
        "group_emotionality": _label(scenario, "emotionality"),
        "day_time": _label(scenario, "day_time"),
        "teacher_notes": scenario.teacher_notes or "",
        "ai_mode": scenario.ai_mode,
    }

    subject_content = extra_params.get("subject_content") or scenario.subject_content or ""

    techniques = []
    for it in items:
        card = cards_by_id.get(it.technique_card_id)
        if not card:
            continue

        duration = it.custom_duration_min or card.duration_min or 0
        techniques.append(
            {
                "position": it.position,
                "card_id": card.id,
                "title": card.title,
                "kind": _label(card, "card_kind"),
                "description": html_to_text(card.description_html),
                "duration_min": int(duration),
                "activity_type": _label(card, "activity_type"),
                "bloom_level": _label(card, "bloom_level"),
                "work_forms": _work_forms(card),
                "competencies_4k": _competencies(card),
                "suitable_stages": _stages(card),
            }
        )

    total = sum(t["duration_min"] for t in techniques)
    lesson_total = scenario.duration_min or 0

    return {
        "passport": passport,
        "techniques": techniques,
        "subject_content": subject_content,
        "timing": {
            "techniques_total_min": total,
            "lesson_total_min": lesson_total,
            "reserve_min": lesson_total - total,
        },
    }


AI_MODE_RULES = {
    "strict": (
        "Режим STRICT: используй только приёмы из списка techniques, в заданном порядке, "
        "с указанной длительностью. Ничего не добавляй от себя, кроме связок между этапами."
    ),
    "balanced": (
        "Режим BALANCED: сохрани выбранные приёмы и их порядок. Можно коротко добавить "
        "оргмомент, переходы и рефлексию, если их нет, и аккуратно перераспределить время, "
        "чтобы урок уложился в общую длительность."
    ),
    "free": (
        "Режим FREE: выбранные приёмы — основа, но можно менять порядок, сокращать или "
        "дополнять их, если это лучше служит цели урока. Каждое изменение кратко обоснуй."
    ),
}


def build_multiagent_prompt(ai_mode: str = "balanced") -> str:
    """
    System prompt для генерации план-конспекта. Данные урока приходят отдельным
    сообщением пользователя в формате JSON (lesson_input).
    """
    mode_rule = AI_MODE_RULES.get((ai_mode or "").lower(), AI_MODE_RULES["balanced"])

    return f"""Ты — команда из четырёх экспертов, которые вместе готовят план-конспект урока для учителя российской школы. Работайте последовательно, как конвейер:

1. Аналитик. Изучи паспорт урока: предмет, класс, цель, длительность, эмоциональное состояние группы, время дня, заметки учителя. Сформулируй образовательные, развивающие и воспитательные задачи и планируемые результаты (предметные, метапредметные, личностные) в духе ФГОС.
2. Методист. Разложи выбранные приёмы (techniques) по этапам урока: организационный момент, мотивация и актуализация, основная часть, закрепление, рефлексия и итог. Для каждого приёма опиши, как именно он применяется на материале урока (subject_content), а не в общем виде. Учитывай форму работы, уровень по таксономии Блума и развиваемые компетенции 4К.
3. Хронометрист. Проверь тайминг: сумма времени этапов должна равняться длительности урока (timing.lesson_total_min). Если приёмы не помещаются или остаётся запас, перераспределяй время согласно режиму. Учитывай состояние группы: быстро утомляемым и очень активным группам нужна смена активной и спокойной деятельности, тревожным — понятные инструкции и безопасная обстановка.
4. Редактор. Собери итоговый текст, проверь, что он конкретен, логичен и готов к использованию на уроке без доработки.

{mode_rule}

Правила:
- Пиши по-русски, обращаясь к учителю. Не придумывай факты о группе, которых нет во входных данных.
- Если каких-то данных нет (например, темы или цели), сделай разумное допущение и явно отметь его в разделе «Допущения».
- Не выводи промежуточные рассуждения экспертов, только итоговый план-конспект.
- Формат ответа: обычный текст с простой разметкой Markdown (заголовки ##, списки, таблица хронометража). Без HTML.

Структура ответа:
## Паспорт урока
Тема, предмет, класс, длительность, тип урока, цель.
## Задачи и планируемые результаты
## Оборудование и материалы
## Ход урока
Для каждого этапа: название и время, используемый приём, деятельность учителя, деятельность учеников, формулировки ключевых заданий и вопросов, ожидаемый результат.
## Хронометраж
Таблица: этап | приём | минуты. Последняя строка — итог, равный длительности урока.
## Рефлексия и домашнее задание
## Советы учителю
2–4 практических совета с учётом особенностей группы.
## Допущения
Только если делались допущения."""
