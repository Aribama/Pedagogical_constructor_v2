# backend/ai/providers/registry.py
import os
from typing import List

from .base import AIProvider
from .dummy import DummyProvider


def list_providers() -> List[str]:
    return ["local", "deepseek"]


def deepseek_configured() -> bool:
    return bool(os.getenv("DEEPSEEK_API_KEY", "").strip())


def get_provider(name: str) -> AIProvider:
    """
    deepseek — нейросеть DeepSeek (нужен DEEPSEEK_API_KEY);
    local / dummy — встроенный офлайн-генератор.
    Если DeepSeek запрошен, но ключ не задан, используется офлайн-генератор.
    """
    name = (name or "").lower().strip()

    if name == "deepseek" and deepseek_configured():
        from .deepseek import DeepSeekProvider
        return DeepSeekProvider()

    return DummyProvider()
