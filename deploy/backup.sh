#!/usr/bin/env bash
# Резервная копия базы в папку backups/ рядом с проектом.
#   ./deploy/backup.sh
# Восстановление:
#   gunzip -c backups/<файл>.sql.gz | docker compose exec -T db psql -U lessonapp_user -d lessonapp_db
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/lessonapp_$(date +%Y-%m-%d_%H-%M).sql.gz"
docker compose exec -T db pg_dump -U lessonapp_user -d lessonapp_db | gzip > "$FILE"
echo "Сохранено: $FILE"
