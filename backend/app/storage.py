from pathlib import Path
import os, tempfile
from .config import STORAGE_DIR, CATALOG_PATH

class LocalStorage:
    def __init__(self, root: Path = STORAGE_DIR): self.root = root; root.mkdir(parents=True, exist_ok=True)
    def save(self, name: str, data: bytes) -> str:
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, temp = tempfile.mkstemp(dir=target.parent, prefix=".upload-")
        try:
            with os.fdopen(fd, "wb") as f: f.write(data)
            os.replace(temp, target)
        finally:
            if os.path.exists(temp): os.unlink(temp)
        return str(target.relative_to(self.root)).replace("\\", "/")
    def write_catalog_atomic(self, data: bytes, path: Path | None = None):
        path = path or (self.root / "catalogue.json")
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp = tempfile.mkstemp(dir=path.parent, prefix=".catalogue-")
        try:
            with os.fdopen(fd, "wb") as f: f.write(data); f.flush(); os.fsync(f.fileno())
            os.replace(temp, path)
        finally:
            if os.path.exists(temp): os.unlink(temp)
    def read_catalog(self, path: Path | None = None):
        path = path or (self.root / "catalogue.json")
        return path.read_bytes() if path.exists() else b'{"sections":[]}'

storage = LocalStorage()
