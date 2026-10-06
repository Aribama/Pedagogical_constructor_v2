from __future__ import annotations

from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from audit.models import AuditAction, EntityType
from audit.services import log_event

from .models import Scenario, ScenarioItem
from .serializers import (
    ScenarioReadSerializer,
    ScenarioPatchSerializer,
    ScenarioSaveAsSerializer,
    ScenarioItemsAutosaveSerializer,
)


class ScenarioViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Scenario.objects
            .filter(owner=self.request.user)
            .prefetch_related("items", "items__technique_card")
            .order_by("-updated_at")
        )

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return ScenarioPatchSerializer
        return ScenarioReadSerializer

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().filter(name__isnull=False)
        return Response(ScenarioReadSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="default")
    def default(self, request):
        """
        GET /api/scenarios/default/
        Возвращает default (name NULL), создаёт если нет.
        """
        qs = Scenario.objects.filter(owner=request.user, name__isnull=True).order_by("id")
        obj = qs.first()
        if not obj:
            obj = Scenario.objects.create(owner=request.user, name=None)
            log_event(
                actor=request.user,
                action=AuditAction.CREATE,
                entity_type=EntityType.SCENARIO,
                entity_id=obj.id,
                meta={"default": True},
            )
        return Response(ScenarioReadSerializer(obj).data)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.name is None:
            raise ValidationError({"detail": "Нельзя удалить сценарий по умолчанию."})
        sid = obj.id
        obj.delete()
        log_event(
            actor=request.user,
            action=AuditAction.DELETE,
            entity_type=EntityType.SCENARIO,
            entity_id=sid,
            meta={},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="save-as")
    def save_as_detail(self, request, pk=None):
        """
        POST /api/scenarios/{id}/save-as {name:"..."}
        По ТЗ:
          - {id} должен быть default (name NULL)
          - создаём новый именованный сценарий как копию default (включая items)
          - очищаем items у default (default остаётся той же записью)
        """
        default_obj = self.get_object()
        if default_obj.name is not None:
            raise ValidationError({"detail": "save-as доступен только для сценария по умолчанию (name=null)."})

        ser = ScenarioSaveAsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        name = ser.validated_data["name"]

        if Scenario.objects.filter(owner=request.user, name=name).exists():
            raise ValidationError({"name": "Сценарий с таким именем уже существует."})

        with transaction.atomic():
            default_locked = Scenario.objects.select_for_update().get(id=default_obj.id)

            new_scenario = Scenario.objects.create(
                owner=request.user,
                name=name,
                note=default_locked.note,
                grade=default_locked.grade,
                subject=default_locked.subject,
                goal=default_locked.goal,
                emotionality=default_locked.emotionality,
                day_time=default_locked.day_time,
                group_size=default_locked.group_size,
                duration_min=default_locked.duration_min,
                teacher_notes=default_locked.teacher_notes,
                subject_content=default_locked.subject_content,
                plan_text=default_locked.plan_text,
                ai_mode=default_locked.ai_mode,
            )

            src_items = list(ScenarioItem.objects.filter(scenario=default_locked).order_by("position"))
            if src_items:
                ScenarioItem.objects.bulk_create([
                    ScenarioItem(
                        scenario=new_scenario,
                        technique_card=it.technique_card,
                        position=it.position,
                        custom_duration_min=it.custom_duration_min,
                    )
                    for it in src_items
                ])

            ScenarioItem.objects.filter(scenario=default_locked).delete()

            log_event(
                actor=request.user,
                action=AuditAction.CREATE,
                entity_type=EntityType.SCENARIO,
                entity_id=new_scenario.id,
                meta={"save_as": True, "from_default": default_locked.id},
            )

        new_scenario.refresh_from_db()
        return Response(ScenarioReadSerializer(new_scenario).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="save-as")
    def save_as_legacy(self, request):
        """
        Legacy endpoint для совместимости:
        POST /api/scenarios/save-as {name:"..."}
        Делает то же самое, что detail save-as, используя default автоматически.
        """
        qs = Scenario.objects.filter(owner=request.user, name__isnull=True).order_by("id")
        default_obj = qs.first() or Scenario.objects.create(owner=request.user, name=None)

        self.kwargs["pk"] = str(default_obj.id)
        return self.save_as_detail(request, pk=default_obj.id)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """
        POST /api/scenarios/{id}/duplicate/
        Дублирует именованный сценарий (name != NULL):
          - создаёт новую запись Scenario с именем "<name> (копия)" (с уникализацией)
          - копирует items вместе с custom_duration_min и position
        """
        src = self.get_object()

        if src.name is None:
            raise ValidationError({"detail": "Нельзя дублировать сценарий по умолчанию (name=null)."})

        base = f"{src.name} (копия)"
        new_name = base
        i = 2
        while Scenario.objects.filter(owner=request.user, name=new_name).exists():
            new_name = f"{base} {i}"
            i += 1

        with transaction.atomic():
            new_scenario = Scenario.objects.create(
                owner=request.user,
                name=new_name,
                note=src.note,
                grade=src.grade,
                subject=src.subject,
                goal=src.goal,
                emotionality=src.emotionality,
                day_time=src.day_time,
                group_size=src.group_size,
                duration_min=src.duration_min,
                teacher_notes=src.teacher_notes,
                subject_content=src.subject_content,
                plan_text=src.plan_text,
                ai_mode=src.ai_mode,
            )

            src_items = list(ScenarioItem.objects.filter(scenario=src).order_by("position"))
            if src_items:
                ScenarioItem.objects.bulk_create([
                    ScenarioItem(
                        scenario=new_scenario,
                        technique_card=it.technique_card,
                        position=it.position,
                        custom_duration_min=it.custom_duration_min,
                    )
                    for it in src_items
                ])

            log_event(
                actor=request.user,
                action=AuditAction.CREATE,
                entity_type=EntityType.SCENARIO,
                entity_id=new_scenario.id,
                meta={"duplicate": True, "from": src.id},
            )

        new_scenario.refresh_from_db()
        return Response(ScenarioReadSerializer(new_scenario).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put"], url_path="autosave-items")
    def autosave_items(self, request, pk=None):
        """
        PUT /api/scenarios/{id}/autosave-items {items:[...]}
        Полностью заменяет items.
        """
        scenario = self.get_object()
        ser = ScenarioItemsAutosaveSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        items = ser.validated_data["items"]

        with transaction.atomic():
            ScenarioItem.objects.filter(scenario=scenario).delete()
            bulk = []
            for it in items:
                bulk.append(
                    ScenarioItem(
                        scenario=scenario,
                        technique_card_id=int(it["technique_card"]),
                        position=int(it["position"]),
                        custom_duration_min=(
                            int(it["custom_duration_min"])
                            if ("custom_duration_min" in it and it["custom_duration_min"] is not None)
                            else None
                        ),
                    )
                )
            if bulk:
                ScenarioItem.objects.bulk_create(bulk)

        log_event(
            actor=request.user,
            action=AuditAction.UPDATE,
            entity_type=EntityType.SCENARIO,
            entity_id=scenario.id,
            meta={"autosave_items": True, "count": len(items)},
        )
        scenario.refresh_from_db()
        return Response(ScenarioReadSerializer(scenario).data, status=status.HTTP_200_OK)
