"""Shared fixtures for payments backend tests.

Auth-gated payments endpoints cannot be exercised with a real Supabase user
(no test account exists, per briefing). We therefore import the FastAPI app
once per test module and use app.dependency_overrides to stand in for a
logged-in user / admin, exactly as instructed by the acceptance matrix.
Unauthenticated behaviour (401s, validation, webhook signature) is still
verified against the real running server on :8001 over plain HTTP.
"""
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import os  # noqa: E402

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

from server import app  # noqa: E402
from services.supabase import AuthUser, current_user  # noqa: E402

BASE_URL = "http://localhost:8001"


def make_user(prefix: str) -> AuthUser:
    return AuthUser(uid=f"tscheck-{prefix}-{uuid.uuid4().hex[:8]}", token="faketoken")


@pytest.fixture(scope="session")
def _shared_client():
    # Motor binds its background topology to the event loop of the first request it
    # serves; TestClient spins up a fresh loop per "with" block, so a single shared
    # client (one loop, for the whole session) avoids "Event loop is closed" errors
    # on the second and later tests that touch the payment_transactions collection.
    with TestClient(app) as c:
        yield c


@pytest.fixture
def api_client(_shared_client):
    """TestClient against the in-process app, used only to apply dependency_overrides."""
    yield _shared_client
    app.dependency_overrides.clear()


@pytest.fixture
def mongo_tx():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "leonida_explorer")
    client = MongoClient(mongo_url)
    yield client[db_name]["payment_transactions"]
    client.close()
