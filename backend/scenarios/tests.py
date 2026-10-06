from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from cards.models import TechniqueCard

from .models import Scenario


class ScenarioApiTests(TestCase):
    def setUp(self):
        call_command("seed_demo", verbosity=0)
        self.user = get_user_model().objects.get(username="teacher")
        self.scenario = Scenario.objects.get(owner=self.user, name=None)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_passport_fields_are_saved(self):
        r = self.client.patch(
            f"/api/scenarios/{self.scenario.id}/",
            {"name": "Дроби", "note": "Сравнение дробей", "grade": 6,
             "emotionality": "tires_fast", "day_time": "begin", "ai_mode": "strict"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.scenario.refresh_from_db()
        self.assertEqual(self.scenario.grade, 6)
        self.assertEqual(self.scenario.emotionality, "tires_fast")
        self.assertEqual(self.scenario.day_time, "begin")
        self.assertEqual(self.scenario.ai_mode, "strict")

    def test_items_show_card_duration(self):
        card = TechniqueCard.objects.get(title="Зигзаг")
        r = self.client.put(
            f"/api/scenarios/{self.scenario.id}/autosave-items/",
            {"items": [{"technique_card": card.id, "position": 1}]},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        item = self.client.get(f"/api/scenarios/{self.scenario.id}/").json()["items"][0]
        self.assertEqual(item["duration_min"], 15)
        self.assertEqual(item["card_kind"], "technique")

    def test_cannot_add_someone_elses_draft_card(self):
        other = get_user_model().objects.create_user("other", password="x")
        draft = TechniqueCard.objects.create(
            owner=other, author=other, title="secret", description_html="x",
            duration_min=5, activity_type="calm", bloom_level="apply",
        )
        r = self.client.put(
            f"/api/scenarios/{self.scenario.id}/autosave-items/",
            {"items": [{"technique_card": draft.id, "position": 1}]},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
