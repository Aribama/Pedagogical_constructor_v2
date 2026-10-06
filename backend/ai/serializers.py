from rest_framework import serializers


class GeneratePlanSerializer(serializers.Serializer):
    # id сценария — целое число (BigAutoField)
    scenario_id = serializers.IntegerField(min_value=1)
    provider = serializers.ChoiceField(choices=["deepseek", "local", "dummy"], default="deepseek")
    params = serializers.DictField(required=False, default=dict)
