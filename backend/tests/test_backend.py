import io, json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app
from app.models import Episode, Season, Show

@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); Session = sessionmaker(bind=engine)
    def override():
        db = Session()
        try: yield db
        finally: db.close()
    app.dependency_overrides[get_db] = override
    monkeypatch.setattr("app.main.storage", __import__("app.storage", fromlist=["LocalStorage"]).LocalStorage(tmp_path))
    with TestClient(app) as c: yield c
    app.dependency_overrides.clear()

def auth(role="editor"): return {"Authorization": f"Bearer peblo-{role}-token"}

def test_roles_and_publish(client):
    assert client.get("/admin/shows").status_code == 401
    show = client.post("/admin/shows", headers=auth(), json={"title":"Test","slug":"test","section":"series","status":"published"}).json()
    season = client.post(f"/admin/shows/{show['id']}/seasons", headers=auth(), json={"number":1}).json()
    ep = client.post(f"/admin/seasons/{season['id']}/episodes", headers=auth(), json={"number":1,"title":"Hello","duration_seconds":10,"content_group":"g","status":"published"}).json()
    assert client.post("/admin/catalog/publish", headers=auth()).status_code == 403
    assert client.post("/admin/catalog/publish", headers=auth("admin")).status_code == 422
    assert client.get("/admin/validation-report", headers=auth()).json()["blocking"]

def test_artwork_rejects_wrong_dimensions(client):
    image = Image.new("RGB", (10, 10)); buf = io.BytesIO(); image.save(buf, format="PNG")
    show = client.post("/admin/shows", headers=auth(), json={"title":"T","slug":"t"}).json()
    season = client.post(f"/admin/shows/{show['id']}/seasons", headers=auth(), json={"number":1}).json()
    ep = client.post(f"/admin/seasons/{season['id']}/episodes", headers=auth(), json={"number":1,"title":"E","content_group":"x"}).json()
    res = client.post(f"/admin/episodes/{ep['id']}/artwork/poster", headers=auth(), files={"file":("x.png",buf.getvalue(),"image/png")})
    assert res.status_code == 400
