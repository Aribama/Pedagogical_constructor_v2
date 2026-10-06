from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from .models import CardStatus, TechniqueCard


class SanitizeTests(TestCase):
    def test_description_html_is_cleaned_on_save(self):
        user = get_user_model().objects.create_user("u", password="x")
        card = TechniqueCard.objects.create(
            owner=user,
            author=user,
            title="t",
            description_html='<p onclick="evil()">ok</p><script>alert(1)</script><a href="javascript:x()">l</a>',
            duration_min=5,
            activity_type="calm",
            bloom_level="apply",
        )
        card.refresh_from_db()
        self.assertNotIn("script", card.description_html)
        self.assertNotIn("onclick", card.description_html)
        self.assertNotIn("javascript", card.description_html)
        self.assertIn("<p>ok</p>", card.description_html)


class SeedDemoTests(TestCase):
    def test_seed_is_idempotent(self):
        call_command("seed_demo", verbosity=0)
        first = TechniqueCard.objects.filter(status=CardStatus.PUBLIC).count()
        call_command("seed_demo", verbosity=0)
        self.assertEqual(TechniqueCard.objects.filter(status=CardStatus.PUBLIC).count(), first)
        self.assertGreaterEqual(first, 15)
