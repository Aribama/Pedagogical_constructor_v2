#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput -v 0
if [ "${SEED_DEMO:-1}" = "1" ]; then
  python manage.py seed_demo
fi

exec "$@"
