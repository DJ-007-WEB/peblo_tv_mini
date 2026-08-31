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
    monkeypatch.setattr("app.main.CATALOG_PATH", tmp_path / "catalogue.json")
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

def test_show_seasons_can_be_listed(client):
    show = client.post("/admin/shows", headers=auth(), json={"title":"T","slug":"t"}).json()
    season = client.post(f"/admin/shows/{show['id']}/seasons", headers=auth(), json={"number":1,"title":"Main"}).json()
    response = client.get(f"/admin/shows/{show['id']}/seasons", headers=auth())
    assert response.status_code == 200
    assert response.json()["items"] == [season]

def test_show_listing_is_server_paginated(client):
    for index in range(3):
        response = client.post("/admin/shows", headers=auth(), json={"title": f"Show {index}", "slug": f"show-{index}"})
        assert response.status_code == 201
    response = client.get("/admin/shows?page=2&limit=2", headers=auth())
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["pages"] == 2
    assert len(body["items"]) == 1

def test_readiness_and_liveness(client):
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {"status": "ready"}
