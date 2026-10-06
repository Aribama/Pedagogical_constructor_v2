from __future__ import annotations

import json
import os
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import UserProfile, UserRole
from cards.models import CardStatus, TechniqueCard

DATA_FILE = Path(__file__).resolve().parents[2] / "demo_data" / "cards.json"


class Command(BaseCommand):
    help = "Создать демо-пользователей и набор публичных карточек приёмов (повторный запуск безопасен)"

    def add_arguments(self, parser):
        parser.add_argument("--username", default="teacher", help="Логин демо-учителя")
        parser.add_argument(
            "--password",
            default=os.getenv("DEMO_PASSWORD", "demo12345"),
            help="Пароль демо-пользователей (по умолчанию DEMO_PASSWORD или demo12345)",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        User = get_user_model()
        password = opts["password"]

        methodist, created = User.objects.get_or_create(
            username="methodist", defaults={"email": "methodist@example.com"}
        )
        if created:
            methodist.set_password(password)
            methodist.save()
        UserProfile.objects.update_or_create(user=methodist, defaults={"role": UserRole.MODERATOR})

        teacher, created = User.objects.get_or_create(
            username=opts["username"], defaults={"email": "teacher@example.com"}
        )
        if created:
            teacher.set_password(password)
            teacher.save()

        cards = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        added = 0
        for c in cards:
            if TechniqueCard.objects.filter(title=c["title"], owner=methodist).exists():
                continue
            TechniqueCard.objects.create(
                owner=methodist,
                author=methodist,
                moderated_by=methodist,
                title=c["title"],
                description_html=c["description"],
                card_kind=c["kind"],
                duration_min=c["duration"],
                activity_type=c["activity"],
                bloom_level=c["bloom"],
                age_a1=1 in c["ages"],
                age_a2=2 in c["ages"],
                age_a3=3 in c["ages"],
                work_individual="individual" in c["work"],
                work_group="group" in c["work"],
                k_critical="critical" in c["k"],
                k_creative="creative" in c["k"],
                k_communication="communication" in c["k"],
                k_collaboration="collaboration" in c["k"],
                stage_start="start" in c["stages"],
                stage_core="core" in c["stages"],
                stage_final="final" in c["stages"],
                status=CardStatus.PUBLIC,
            )
            added += 1

        if opts["verbosity"]:
            self.stdout.write(self.style.SUCCESS(
                f"Готово: добавлено карточек {added}, всего публичных "
                f"{TechniqueCard.objects.filter(status=CardStatus.PUBLIC).count()}. "
                f"Вход: {teacher.username} (учитель), methodist (методист)."
            ))
