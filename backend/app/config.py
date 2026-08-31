from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///" + str(ROOT / "backend" / "peblo.db"))
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(ROOT / "backend" / "storage")))
CATALOG_PATH = Path(os.getenv("CATALOG_PATH", str(STORAGE_DIR / "catalogue.json")))
EDITOR_TOKEN = os.getenv("EDITOR_TOKEN", "peblo-editor-token")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "peblo-admin-token")
ALLOWED_ORIGINS = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:4173,http://localhost:4174").split(",") if x.strip()]
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
if ENVIRONMENT == "production" and (EDITOR_TOKEN == "peblo-editor-token" or ADMIN_TOKEN == "peblo-admin-token"):
    raise RuntimeError("EDITOR_TOKEN and ADMIN_TOKEN must be changed in production.")
