# -*- coding: utf-8 -*-
"""DRF serializers for scenarios.

Important:
 - Model fields use: name/note/duration_min.
 - Frontend may historically expect: title/description/duration_minutes.

To keep backward compatibility while we refactor the frontend,
ScenarioReadSerializer returns *both* naming variants.

For updates we accept both variants too (ScenarioPatchSerializer).
"""

from __future__ import annotations

from rest_framework import serializers

from django.db.models import Q

from cards.models import CardStatus, TechniqueCard
from .models import Scenario, ScenarioItem


class ScenarioItemSerializer(serializers.ModelSerializer):
    technique_card = serializers.IntegerField(source="technique_card_id", read_only=True)
    card_id = serializers.IntegerField(source="technique_card_id", read_only=True)
    title = serializers.CharField(source="technique_card.title", read_only=True)
    description = serializers.CharField(source="technique_card.description_html", read_only=True)
    card_kind = serializers.CharField(source="technique_card.card_kind", read_only=True)
    duration_min = serializers.SerializerMethodField()
    stage_label = serializers.SerializerMethodField()

    order = serializers.IntegerField(source="position", read_only=True)
    duration_minutes = serializers.IntegerField(source="custom_duration_min", allow_null=True, read_only=True)

    class Meta:
        model = ScenarioItem
        fields = [
            "id",
            "technique_card",
            "card_id",
            "title",
            "description",
            "position",
            "order",
            "custom_duration_min",
            "duration_minutes",
            "duration_min",
            "card_kind",
            "stage_label",
            "created_at",
        ]

    def get_duration_min(self, obj: ScenarioItem):
        return obj.custom_duration_min or obj.technique_card.duration_min

    def get_stage_label(self, obj: ScenarioItem):
        card = obj.technique_card
        names = [
            title
            for flag, title in (
                (card.stage_start, "начало"),
                (card.stage_core, "основная"),
                (card.stage_final, "итог"),
            )
            if flag
        ]
        return ", ".join(names)


class ScenarioReadSerializer(serializers.ModelSerializer):
    """What the frontend receives."""

    items = ScenarioItemSerializer(many=True, read_only=True)

    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()

    def get_title(self, obj: Scenario):
        return obj.name

    def get_description(self, obj: Scenario):
        return obj.note

    def get_duration_minutes(self, obj: Scenario):
        return obj.duration_min

    class Meta:
        model = Scenario
        fields = [
            "id",
            "owner",
            "created_at",
            "updated_at",

            "name",
            "note",
            "grade",
            "subject",
            "goal",
            "emotionality",
            "day_time",
            "group_size",
            "duration_min",
            "teacher_notes",
            "subject_content",
            "plan_text",
            "ai_mode",

            "title",
            "description",
            "duration_minutes",

            "items",
        ]
        read_only_fields = ["owner", "created_at", "updated_at"]


class ScenarioPatchSerializer(serializers.ModelSerializer):
    """What the frontend sends (partial updates).

    Supports both canonical and legacy field names.
    """

    title = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    duration_minutes = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    class Meta:
        model = Scenario
        fields = [
            "name",
            "note",
            "grade",
            "subject",
            "goal",
            "emotionality",
            "day_time",
            "group_size",
            "duration_min",
            "teacher_notes",
            "subject_content",
            "plan_text",
            "ai_mode",
            "title",
            "description",
            "duration_minutes",
        ]

    def validate_grade(self, value):
        if value is None:
            return value
        if not (1 <= int(value) <= 11):
            raise serializers.ValidationError("grade must be between 1 and 11")
        return int(value)

    def update(self, instance: Scenario, validated_data: dict):
        if "title" in validated_data and "name" not in validated_data:
            instance.name = validated_data.pop("title")
        if "description" in validated_data and "note" not in validated_data:
            instance.note = validated_data.pop("description")
        if "duration_minutes" in validated_data and "duration_min" not in validated_data:
            instance.duration_min = validated_data.pop("duration_minutes")

        return super().update(instance, validated_data)


class ScenarioItemUpsertSerializer(serializers.Serializer):
    """Used by autosave-items endpoint."""

    technique_card = serializers.IntegerField()
    position = serializers.IntegerField(min_value=0)
    custom_duration_min = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def validate_technique_card(self, value: int) -> int:
        qs = TechniqueCard.objects.filter(pk=value)
        request = self.context.get("request")
        if request is not None:
            # В сценарий можно добавить только публичную карточку или свою
            qs = qs.filter(Q(status=CardStatus.PUBLIC) | Q(owner=request.user))
        if not qs.exists():
            raise serializers.ValidationError("TechniqueCard not found")
        return value


class ScenarioItemsAutosaveSerializer(serializers.Serializer):
    items = ScenarioItemUpsertSerializer(many=True)

    def save(self, scenario: Scenario):
        incoming = self.validated_data["items"]

        ScenarioItem.objects.filter(scenario=scenario).delete()

        bulk = [
            ScenarioItem(
                scenario=scenario,
                technique_card_id=it["technique_card"],
                position=it["position"],
                custom_duration_min=it.get("custom_duration_min"),
            )
            for it in incoming
        ]
        if bulk:
            ScenarioItem.objects.bulk_create(bulk)
        return scenario


class ScenarioSaveAsSerializer(serializers.Serializer):
    """Payload for save-as endpoints.

    Views expect {name: "..."}.
    """

    name = serializers.CharField(required=True, allow_blank=False)
