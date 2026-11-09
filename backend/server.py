"""Minimaler Emergent-Backend-Dienst für Leonida Explorer.

Die App selbst (TanStack Start) liegt im Projekt-Hauptordner und nutzt Lovable Cloud (Supabase).
Dieser Dienst existiert nur, weil das Emergent-Deployment einen backend/-Ordner erwartet.
Er nutzt keine Datenbank. Zusätzlich versendet er Web-Push-Mitteilungen (routers/push.py).
"""
import os

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routers.push import router as push_router  # noqa: E402

app = FastAPI(title="Leonida Explorer API")
api_router = APIRouter(prefix="/api")


@api_router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


api_router.include_router(push_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(api_router)
