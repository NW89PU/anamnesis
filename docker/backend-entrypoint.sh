#!/bin/sh
set -e

DB_PATH="${DATABASE_URL:-/data/anamnesis.db}"
DB_DIR=$(dirname "$DB_PATH")

mkdir -p "$DB_DIR" "${UPLOAD_DIR:-/uploads}"

if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] No database at $DB_PATH — initializing with demo patient"
  node src/init-db.js
fi

exec node src/index.js
