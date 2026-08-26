#!/usr/bin/env bash
#
# Bring up a local database and load the schema, so the record layer's tests RUN.
#
# WHY THIS EXISTS. `tests/server/drizzle-store.test.ts` skips when DATABASE_URL is unset, and for
# most of this project's life that was every run on every machine -- DrizzleRecordStore had never
# executed a statement while its suite reported green. CI grew a real MySQL service for that
# reason. This is the same thing locally, so the gap between "passes here" and "passes in CI" is
# not five silently skipped tests.
#
# Usage:
#   ./scripts/dev-db.sh                       # start, create, migrate
#   export DATABASE_URL=$(./scripts/dev-db.sh --url)
#   DATABASE_URL=... npm test
set -euo pipefail

DB_NAME="${DB_NAME:-decision_lab}"
DB_USER="${DB_USER:-lab}"
DB_PASS="${DB_PASS:-lab}"
URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"

if [ "${1:-}" = "--url" ]; then
  echo "$URL"
  exit 0
fi

# MariaDB rather than MySQL because it is what the container image carries. CI runs MySQL 8 on
# purpose -- two engines together say the store is not depending on either one.
if ! mysqladmin ping --silent >/dev/null 2>&1; then
  echo "starting mariadb..."
  service mariadb start >/dev/null
  # Poll rather than sleep: the daemon reports ready on its own schedule.
  until mysqladmin ping --silent >/dev/null 2>&1; do sleep 1; done
fi

# Grants for BOTH 'localhost' and '%'. A TCP connection to 127.0.0.1 resolves to 'localhost' on
# MariaDB, so granting only '%' produces ER_ACCESS_DENIED from a URL that looks correct.
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
GRANT ALL ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
SQL

# EVERY migration in order, the same loop CI runs. Loading 0000 alone is only the schema until a
# second migration exists, and one already did -- the failure it produces is
# `Unknown column ... in 'field list'` from a suite that passes locally because it skipped.
for migration in drizzle/migrations/*.sql; do
  echo "applying $(basename "$migration")"
  sed 's/--> statement-breakpoint//' "$migration" | mysql -u root "${DB_NAME}" 2>/dev/null || true
done

echo "ready:  export DATABASE_URL=$URL"
