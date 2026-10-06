#!/usr/bin/env bash
# Развертывание конструктора на сервере одной командой.
#
#   ./deploy.sh                      — сайт по IP сервера (HTTP)
#   ./deploy.sh lesson.example.ru    — сайт на домене с HTTPS (домен должен указывать на сервер)
#
# Повторный запуск обновляет сайт: пересобирает образы и перезапускает контейнеры,
# данные в базе сохраняются. Нужны Docker и плагин docker compose.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if ! docker compose version >/dev/null 2>&1; then
  echo "Не найден docker compose. Установите Docker: https://docs.docker.com/engine/install/" >&2
  exit 1
fi

[ -f .env ] || cp .env.example .env

get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
set_var() {
  if grep -qE "^$1=" .env; then
    sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else
    echo "$1=$2" >> .env
  fi
}
rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

# Домен из аргумента запоминается в .env
if [ "${1:-}" != "" ]; then set_var SITE_ADDRESS "$1"; fi
SITE="$(get SITE_ADDRESS)"

# Секреты генерируются один раз
[ -n "$(get SECRET_KEY)" ] || set_var SECRET_KEY "$(rand 50)"
[ -n "$(get DATABASE_PASSWORD)" ] || set_var DATABASE_PASSWORD "$(rand 24)"
[ -n "$(get DEMO_PASSWORD)" ] || set_var DEMO_PASSWORD "$(rand 10)"

if [ -n "$SITE" ] && [ "$SITE" != ":80" ]; then
  URL="https://$SITE"
  set_var ALLOWED_HOSTS "$SITE,localhost,127.0.0.1,backend"
  set_var CSRF_TRUSTED_ORIGINS "$URL"
  set_var SECURE_COOKIES True
  set_var BEHIND_HTTPS_PROXY True
else
  IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  URL="http://$IP"
  set_var SITE_ADDRESS ""
  set_var ALLOWED_HOSTS "$IP,localhost,127.0.0.1,backend"
  set_var CSRF_TRUSTED_ORIGINS "$URL"
  set_var SECURE_COOKIES False
  set_var BEHIND_HTTPS_PROXY False
fi

echo "Собираю и запускаю контейнеры…"
$COMPOSE up -d --build --remove-orphans

echo
echo "Готово: $URL"
if [ "$(get SEED_DEMO)" = "1" ]; then
  echo "Демо-вход: teacher / $(get DEMO_PASSWORD)  (методист: methodist / тот же пароль)"
fi
echo "Логи: $COMPOSE logs -f backend"
echo "Резервная копия базы: ./deploy/backup.sh"
