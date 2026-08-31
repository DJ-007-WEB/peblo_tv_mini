from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///" + str(ROOT / "backend" / "peblo.db"))
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(ROOT / "backend" / "storage")))
CATALOG_PATH = Path(os.getenv("CATALOG_PATH", str(STORAGE_DIR / "catalogue.json")))
EDITOR_TOKEN = os.getenv("EDITOR_TOKEN", "peblo-editor-token")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "peblo-admin-token")
