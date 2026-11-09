"""Minimaler Emergent-Backend-Dienst für Leonida Explorer.

Die App selbst (TanStack Start) liegt im Projekt-Hauptordner und nutzt Lovable Cloud (Supabase).
Dieser Dienst existiert nur, weil das Emergent-Deployment einen backend/-Ordner erwartet.
Er nutzt keine Datenbank.
"""
import os

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="Leonida Explorer API")
api_router = APIRouter(prefix="/api")


@api_router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(api_router)
