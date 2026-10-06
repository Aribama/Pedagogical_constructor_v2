import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from cards.models import TechniqueCard
from scenarios.models import Scenario, ScenarioItem

from .prompts import build_lesson_input, build_multiagent_prompt, html_to_text


class LessonDataMixin:
    def make_lesson(self):
        call_command("seed_demo", verbosity=0)
        self.user = get_user_model().objects.get(username="teacher")
        self.scenario = Scenario.objects.get(owner=self.user, name=None)
        self.scenario.name = "Дроби"
        self.scenario.subject = "Математика"
        self.scenario.grade = 5
        self.scenario.goal = "Научиться сравнивать обыкновенные дроби"
        self.scenario.subject_content = "Сравнение дробей с одинаковыми знаменателями."
        self.scenario.duration_min = 45
        self.scenario.save()

        titles = ["Приветствие по кругу", "Кластер", "Зигзаг", "Рефлексия «Светофор»"]
        for pos, title in enumerate(titles, start=1):
            card = TechniqueCard.objects.get(title=title)
            ScenarioItem.objects.create(scenario=self.scenario, technique_card=card, position=pos)


class LessonInputTests(LessonDataMixin, TestCase):
    def setUp(self):
        self.make_lesson()

    def test_lesson_input_contains_real_scenario_and_card_data(self):
        items = list(self.scenario.items.order_by("position"))
        cards = {c.id: c for c in TechniqueCard.objects.all()}
        data = build_lesson_input(scenario=self.scenario, items=items, cards_by_id=cards)

        self.assertEqual(data["passport"]["title"], "Дроби")
        self.assertEqual(data["passport"]["subject"], "Математика")
        self.assertEqual(data["passport"]["grade"], 5)
        self.assertEqual(data["subject_content"], "Сравнение дробей с одинаковыми знаменателями.")
        self.assertEqual([t["title"] for t in data["techniques"]][1], "Кластер")
        # описание берётся из description_html и очищается от тегов
        self.assertIn("ключевое понятие", data["techniques"][1]["description"])
        self.assertNotIn("<p>", data["techniques"][1]["description"])
        self.assertEqual(data["timing"]["techniques_total_min"], 2 + 10 + 15 + 2)
        self.assertEqual(data["timing"]["reserve_min"], 45 - 29)

    def test_system_prompt_is_not_empty_and_depends_on_mode(self):
        strict = build_multiagent_prompt("strict")
        free = build_multiagent_prompt("free")
        self.assertGreater(len(strict), 500)
        self.assertIn("STRICT", strict)
        self.assertIn("FREE", free)

    def test_html_to_text(self):
        self.assertEqual(html_to_text("<p>Раз&nbsp;два</p><p>три</p>"), "Раз\xa0два\n\nтри")


@override_settings(SECURE_SSL_REDIRECT=False)
class GeneratePlanApiTests(LessonDataMixin, TestCase):
    def setUp(self):
        self.make_lesson()
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @mock.patch.dict("os.environ", {"DEEPSEEK_API_KEY": ""})
    def test_falls_back_to_local_generator_without_key(self):
        r = self.client.post(
            "/api/ai/generate-plan/",
            {"scenario_id": self.scenario.id, "provider": "deepseek"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual(body["meta"]["provider"], "local")
        self.assertIn("## Хронометраж", body["plan_text"])
        self.assertIn("Зигзаг", body["plan_text"])
        self.scenario.refresh_from_db()
        self.assertEqual(self.scenario.plan_text, body["plan_text"])

    @mock.patch.dict("os.environ", {"DEEPSEEK_API_KEY": "test-key"})
    @mock.patch("ai.providers.deepseek.requests.post")
    def test_deepseek_receives_prompt_and_lesson_data(self, post):
        post.return_value.json.return_value = {"choices": [{"message": {"content": "## План"}}]}
        post.return_value.raise_for_status.return_value = None

        r = self.client.post(
            "/api/ai/generate-plan/",
            {"scenario_id": self.scenario.id, "provider": "deepseek"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["plan_text"], "## План")

        messages = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("Хронометрист", messages[0]["content"])
        user_data = json.loads(messages[1]["content"])
        self.assertEqual(user_data["passport"]["subject"], "Математика")
        self.assertEqual(len(user_data["techniques"]), 4)

    def test_other_users_scenario_is_not_accessible(self):
        other = get_user_model().objects.create_user("other", password="x")
        self.client.force_authenticate(other)
        r = self.client.post(
            "/api/ai/generate-plan/", {"scenario_id": self.scenario.id}, format="json"
        )
        self.assertEqual(r.status_code, 400)
