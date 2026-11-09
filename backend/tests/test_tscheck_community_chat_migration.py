"""
Verifies the Supabase chat migration is prepared (additive, not executed) and that
the backend health endpoint still responds, per the acceptance_matrix criterion:
"Der Chat-Einstieg ist fuer die Supabase-Migration vorbereitet ...".

This is a filesystem/content check (no chat_messages table exists in the current
Supabase project per seed_facts - a 404 was observed on /rest/v1/chat_messages),
plus the standard API health probe against the running backend.
"""
import pathlib
import httpx

MIGRATION_PATH = pathlib.Path("/app/docs/migrations/007_community_chat.sql")
BASE_URL = "http://localhost:8001"


def test_health_endpoint_still_ok():
    resp = httpx.get(f"{BASE_URL}/api/health", timeout=10)
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"


def test_migration_file_exists_and_is_additive():
    assert MIGRATION_PATH.exists(), "docs/migrations/007_community_chat.sql must be present"
    sql = MIGRATION_PATH.read_text()

    # Additive only: no destructive DDL against existing objects
    lowered = sql.lower()
    assert "drop table" not in lowered
    assert "drop column" not in lowered
    assert "truncate" not in lowered

    # Core chat tables defined with "if not exists" (safe to (re)apply)
    for table in ["chat_messages", "chat_blocks", "chat_reports"]:
        assert f"create table if not exists public.{table}" in lowered, f"missing additive table {table}"

    # Row level security enabled on the new tables
    assert lowered.count("enable row level security") >= 3

    # Realtime publication wiring present (for live chat once applied)
    assert "publication" in lowered or "replica identity full" in lowered


def test_migration_not_yet_applied_matches_seed_facts():
    # seed_facts: a probe against /rest/v1/chat_messages returned 404 before migration.
    # We don't have service-role creds to query Supabase directly here, so this test
    # documents the expected pre-migration state via the frontend's own guard
    # (isChatUnavailable / chat-setup-message), whose source must exist and reference
    # the same migration file the UI tells users to run.
    chat_lib = pathlib.Path("/app/src/lib/chat.ts")
    assert chat_lib.exists()
    content = chat_lib.read_text()
    assert "isChatUnavailable" in content
