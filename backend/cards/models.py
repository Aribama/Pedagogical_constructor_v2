from django.conf import settings
from django.db import models

from .sanitize import sanitize_html


class CardStatus(models.TextChoices):
    DRAFT = "draft", "Черновик (личная)"
    PENDING = "pending", "На модерации"
    REJECTED = "rejected", "Отклонена"
    PUBLIC = "public", "Публичная"
    ARCHIVED = "archived", "В архиве"


class ActivityType(models.TextChoices):
    ACTIVE = "active", "Активная"
    CALM = "calm", "Спокойная"


class BloomLevel(models.TextChoices):
    REMEMBER = "remember", "Запоминание"
    UNDERSTAND = "understand", "Понимание"
    APPLY = "apply", "Применение"
    ANALYZE = "analyze", "Анализ"
    EVALUATE = "evaluate", "Оценка"
    CREATE = "create", "Создание"


class TechniqueCard(models.Model):
    class Meta:
        verbose_name = "Методическая карточка"
        verbose_name_plural = "Методические карточки"
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cards",
    )
    title = models.CharField(max_length=255)
    description_html = models.TextField()
    duration_min = models.PositiveSmallIntegerField()

    age_a1 = models.BooleanField(default=False)  # 1-4
    age_a2 = models.BooleanField(default=False)  # 5-8
    age_a3 = models.BooleanField(default=False)  # 9-11

    activity_type = models.CharField(max_length=16, choices=ActivityType.choices)

    work_individual = models.BooleanField(default=False)
    work_group = models.BooleanField(default=False)

    bloom_level = models.CharField(max_length=16, choices=BloomLevel.choices)

    k_critical = models.BooleanField(default=False)
    k_creative = models.BooleanField(default=False)
    k_communication = models.BooleanField(default=False)
    k_collaboration = models.BooleanField(default=False)

    stage_start = models.BooleanField(default=False)
    stage_core = models.BooleanField(default=False)
    stage_final = models.BooleanField(default=False)

    status = models.CharField(max_length=16, choices=CardStatus.choices, default=CardStatus.DRAFT)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cards_authored"
    )
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="cards_moderated"
    )
    moderated_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "title"]),
            models.Index(fields=["author", "status"]),
            models.Index(fields=["title"]),
        ]
    class CardKind(models.TextChoices):
        TECHNIQUE = "technique", "Методика"
        AUX_TEAM_SPLIT = "aux_team_split", "Вспомогательная: деление на команды"
        AUX_WARMUP = "aux_warmup", "Вспомогательная: разминка"
        AUX_ORG = "aux_org", "Вспомогательная: оргмомент"
        AUX_REFLECTION = "aux_reflection", "Вспомогательная: рефлексия"

    card_kind = models.CharField(
        max_length=32,
        choices=CardKind.choices,
        default=CardKind.TECHNIQUE,
        db_index=True,
    )
    def save(self, *args, **kwargs):
        self.description_html = sanitize_html(self.description_html)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.title
