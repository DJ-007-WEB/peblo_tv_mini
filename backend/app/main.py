from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
import io, json
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .auth import require_admin, require_editor
from .catalog import build_catalog, catalog_bytes
from .config import STORAGE_DIR
from .db import Base, engine, get_db
from .models import Artwork, Episode, PublishRun, Season, Show
from .schemas import EpisodeIn, SeasonIn, ShowIn, episode_out, season_out, show_out
from .storage import storage
from .validation import validation_report

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    yield

app = FastAPI(title="Peblo TV API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/artwork", StaticFiles(directory=str(STORAGE_DIR)), name="artwork")

def commit(db):
    try: db.commit()
    except IntegrityError as exc:
        db.rollback(); raise HTTPException(409, "That slug or content_group/language already exists.") from exc

def ensure_episode_key(db, content_group, language, exclude_id=None):
    query = select(Episode).where(Episode.content_group == content_group, Episode.language == language)
    if exclude_id is not None: query = query.where(Episode.id != exclude_id)
    if db.scalar(query): raise HTTPException(409, "An episode with that content_group and language already exists.")

@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1)); return {"status": "ok"}

@app.get("/admin/shows")
def list_shows(q: str | None = None, section: str | None = None, status: str | None = None, language: str | None = None, db: Session = Depends(get_db), _=Depends(require_editor)):
    shows = db.scalars(select(Show).order_by(Show.title, Show.id)).all()
    out = []
    for show in shows:
        if q and q.lower() not in show.title.lower(): continue
        if section and show.section != section: continue
        if status and show.status != status: continue
        if language and not any(e.language == language for s in show.seasons for e in s.episodes): continue
        out.append(show_out(show))
    return {"items": out}

@app.post("/admin/shows", status_code=201)
def create_show(body: ShowIn, db: Session = Depends(get_db), _=Depends(require_editor)):
    show = Show(**body.model_dump()); db.add(show); commit(db); db.refresh(show); return show_out(show)

@app.get("/admin/shows/{show_id}")
def get_show(show_id: int, db: Session = Depends(get_db), _=Depends(require_editor)):
    show = db.get(Show, show_id)
    if not show: raise HTTPException(404, "Show not found")
    return show_out(show)

@app.patch("/admin/shows/{show_id}")
def update_show(show_id: int, body: ShowIn, db: Session = Depends(get_db), _=Depends(require_editor)):
    show = db.get(Show, show_id)
    if not show: raise HTTPException(404, "Show not found")
    for k, v in body.model_dump().items(): setattr(show, k, v)
    commit(db); return show_out(show)

@app.delete("/admin/shows/{show_id}", status_code=204)
def delete_show(show_id: int, db: Session = Depends(get_db), _=Depends(require_editor)):
    show = db.get(Show, show_id)
    if not show: raise HTTPException(404, "Show not found")
    db.delete(show); commit(db)

@app.post("/admin/shows/{show_id}/seasons", status_code=201)
def create_season(show_id: int, body: SeasonIn, db: Session = Depends(get_db), _=Depends(require_editor)):
    if not db.get(Show, show_id): raise HTTPException(404, "Show not found")
    season = Season(show_id=show_id, **body.model_dump()); db.add(season); commit(db); db.refresh(season); return season_out(season)

@app.get("/admin/shows/{show_id}/seasons")
def list_seasons(show_id: int, db: Session = Depends(get_db), _=Depends(require_editor)):
    if not db.get(Show, show_id): raise HTTPException(404, "Show not found")
    seasons = db.scalars(select(Season).where(Season.show_id == show_id).order_by(Season.number, Season.id)).all()
    return {"items": [season_out(season) for season in seasons]}

@app.get("/admin/seasons/{season_id}")
def get_season(season_id: int, db: Session = Depends(get_db), _=Depends(require_editor)):
    season = db.get(Season, season_id)
    if not season: raise HTTPException(404, "Season not found")
    return {**season_out(season), "episodes": [episode_out(e) for e in season.episodes]}

@app.patch("/admin/seasons/{season_id}")
def update_season(season_id: int, body: SeasonIn, db: Session = Depends(get_db), _=Depends(require_editor)):
    season = db.get(Season, season_id)
    if not season: raise HTTPException(404, "Season not found")
    season.number, season.title = body.number, body.title; commit(db); return season_out(season)

@app.delete("/admin/seasons/{season_id}", status_code=204)
def delete_season(season_id: int, db: Session = Depends(get_db), _=Depends(require_editor)):
    season = db.get(Season, season_id)
    if not season: raise HTTPException(404, "Season not found")
    db.delete(season); commit(db)

@app.post("/admin/seasons/{season_id}/episodes", status_code=201)
def create_episode(season_id: int, body: EpisodeIn, db: Session = Depends(get_db), _=Depends(require_editor)):
    if not db.get(Season, season_id): raise HTTPException(404, "Season not found")
    ensure_episode_key(db, body.content_group, body.language)
    ep = Episode(season_id=season_id, **body.model_dump()); db.add(ep); commit(db); db.refresh(ep); return episode_out(ep)

@app.get("/admin/episodes/{episode_id}")
def get_episode(episode_id: int, db: Session = Depends(get_db), _=Depends(require_editor)):
    ep = db.get(Episode, episode_id)
    if not ep: raise HTTPException(404, "Episode not found")
    return episode_out(ep)

@app.patch("/admin/episodes/{episode_id}")
def update_episode(episode_id: int, body: EpisodeIn, db: Session = Depends(get_db), _=Depends(require_editor)):
    ep = db.get(Episode, episode_id)
    if not ep: raise HTTPException(404, "Episode not found")
    ensure_episode_key(db, body.content_group, body.language, episode_id)
    for k, v in body.model_dump().items(): setattr(ep, k, v)
    commit(db); return episode_out(ep)

@app.delete("/admin/episodes/{episode_id}", status_code=204)
def delete_episode(episode_id: int, db: Session = Depends(get_db), _=Depends(require_editor)):
    ep = db.get(Episode, episode_id)
    if not ep: raise HTTPException(404, "Episode not found")
    db.delete(ep); commit(db)

SPECS = {"poster": (600, 900, 2 / 3), "banner": (1280, 720, 16 / 9), "thumbnail": (640, 360, 16 / 9)}
@app.post("/admin/episodes/{episode_id}/artwork/{kind}")
async def upload_artwork(episode_id: int, kind: str, file: UploadFile = File(...), db: Session = Depends(get_db), _=Depends(require_editor)):
    if kind not in SPECS: raise HTTPException(400, "Artwork type must be poster, banner, or thumbnail.")
    ep = db.get(Episode, episode_id)
    if not ep: raise HTTPException(404, "Episode not found")
    data = await file.read()
    if len(data) > 200 * 1024: raise HTTPException(400, "Image must be 200 KB or smaller.")
    try:
        image = Image.open(io.BytesIO(data)); image.verify(); image = Image.open(io.BytesIO(data))
    except (UnidentifiedImageError, OSError) as exc: raise HTTPException(400, "Upload a valid image file.") from exc
    width, height, ratio = SPECS[kind]
    if (image.width, image.height) != (width, height): raise HTTPException(400, f"{kind} must be exactly {width} x {height} pixels.")
    if abs(image.width / image.height - ratio) > 0.01: raise HTTPException(400, f"{kind} must use a {width}:{height} aspect ratio.")
    path = storage.save(f"episodes/{episode_id}/{kind}{Path(file.filename or '.jpg').suffix.lower() or '.jpg'}", data)
    old = db.scalar(select(Artwork).where(Artwork.episode_id == episode_id, Artwork.kind == kind))
    if old: old.path, old.width, old.height, old.size_bytes = path, width, height, len(data)
    else: db.add(Artwork(episode_id=episode_id, kind=kind, path=path, width=width, height=height, size_bytes=len(data)))
    commit(db); return {"kind": kind, "url": f"/artwork/{path}"}

@app.get("/admin/validation-report")
def report(db: Session = Depends(get_db), _=Depends(require_editor)): return validation_report(db)

@app.post("/admin/catalog/publish")
def publish(user=Depends(require_admin), db: Session = Depends(get_db)):
    report_data = validation_report(db)
    run = PublishRun(actor=user["name"]); db.add(run); db.flush()
    if report_data["blocking"]:
        run.outcome, run.error, run.finished_at = "blocked", "Validation report has blocking issues", datetime.utcnow(); commit(db)
        raise HTTPException(422, {"message": "Publish blocked.", "report": report_data})
    try:
        data = catalog_bytes(db); storage.write_catalog_atomic(data)
        catalogue = build_catalog(db); run.show_count = sum(len(s["shows"]) for s in catalogue["sections"]); run.episode_count = sum(len(e["episodes"]) for s in catalogue["sections"] for sh in s["shows"] for e in sh["seasons"]); run.outcome, run.finished_at = "success", datetime.utcnow(); commit(db)
        return {"run_id": run.id, "outcome": run.outcome, "show_count": run.show_count, "episode_count": run.episode_count}
    except Exception as exc:
        db.rollback(); run.outcome, run.error, run.finished_at = "failed", str(exc), datetime.utcnow(); db.add(run); db.commit(); raise HTTPException(500, "Catalogue publish failed.") from exc

@app.get("/admin/catalog/runs")
def runs(db: Session = Depends(get_db), _=Depends(require_editor)):
    return {"items": [{"id": r.id, "actor": r.actor, "started_at": r.started_at, "finished_at": r.finished_at, "outcome": r.outcome, "show_count": r.show_count, "episode_count": r.episode_count, "error": r.error} for r in db.scalars(select(PublishRun).order_by(PublishRun.id.desc())).all()]}

@app.get("/catalog")
def catalog(): return json.loads(storage.read_catalog())

@app.get("/catalog/search")
def search(q: str = "", category: str | None = None, language: str | None = None, section: str | None = None):
    data = json.loads(storage.read_catalog()); result = []
    for sec in data["sections"]:
        if section and sec["name"] != section: continue
        for show in sec["shows"]:
            episode_text = " ".join(e["title"] for s in show["seasons"] for e in s["episodes"])
            text = (show["title"] + " " + show["synopsis"] + " " + " ".join(show["categories"]) + " " + episode_text).lower()
            if q.lower() not in text or (category and category not in show["categories"]): continue
            if language and not any(language in e["languages"] for s in show["seasons"] for e in s["episodes"]): continue
            result.append({**show, "section": sec["name"]})
    return {"items": result}
