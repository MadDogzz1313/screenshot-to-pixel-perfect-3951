#!/usr/bin/env bash
# Lokaler Migrationstest gegen PostgreSQL 15 mit Supabase-Nachbau. Aufruf: bash scripts/sqltest/run.sh [Dateien…]
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=leonida_sqltest
sudo pg_ctlcluster 15 main start 2>/dev/null || true
sudo -u postgres dropdb --if-exists "$DB" >/dev/null
sudo -u postgres createdb "$DB"
run() { echo "== $1"; sudo -u postgres psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -c "set client_min_messages=warning" -f "$1" 2>&1 | grep -v "^NOTICE\|^$\|ergebnis\|^-\|row)" || true; test "${PIPESTATUS[0]}" -eq 0; }
run scripts/sqltest/supabase_mock.sql
run drizzle/migrations/0000_leonida_core.sql
for f in 003_spots_xp_photos 004_profile_badges 004b_profile_privacy_lock 007_community_chat 008_freunde_privatchat_moderation \
         010_push_benachrichtigungen 011_ios_app_push_konto_loeschen 012_username_system 014_crew_finder; do
  run "docs/migrations/$f.sql"
done
for f in "$@"; do run "$f"; done
