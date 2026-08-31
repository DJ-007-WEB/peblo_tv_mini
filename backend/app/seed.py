"""Import the challenge's flat seed_shows.json into the normalized schema."""
import json
from pathlib import Path
import sys
from sqlalchemy import select
from .db import Base, SessionLocal, engine
from .models import Artwork, Episode, Season, Show
from .storage import storage

ARTWORK_FILES = {
    "poster": "poster_good.jpg",
    "banner": "banner_good.jpg",
    "thumbnail": "thumb_good.jpg",
}
ARTWORK_DIMENSIONS = {"poster": (600, 900), "banner": (1280, 720), "thumbnail": (640, 360)}

def seed(source: Path):
    Base.metadata.create_all(engine)
    rows = json.loads(source.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        for row in rows:
            show = db.scalar(select(Show).where(Show.slug == row["slug"]))
            if not show:
                show = Show(title=row["show_title"], slug=row["slug"], synopsis=row.get("synopsis", ""), section=row.get("section"), categories=row.get("categories", []), status=row.get("status", "draft"))
                db.add(show); db.flush()
            season = db.scalar(select(Season).where(Season.show_id == show.id, Season.number == row["season_number"]))
            if not season:
                season = Season(show_id=show.id, number=row["season_number"]); db.add(season); db.flush()
            episode = db.scalar(select(Episode).where(Episode.external_id == row["episode_id"]))
            if not episode:
                episode = Episode(external_id=row["episode_id"], season_id=season.id, number=row["episode_number"], title=row["episode_title"], duration_seconds=row.get("duration_seconds"), language=row.get("language", "en"), content_group=row["content_group"], status=row.get("status", "draft"))
                db.add(episode)
                db.flush()
            for kind in row.get("artwork_available", []):
                source_file = source.parent / "assets" / ARTWORK_FILES.get(kind, "")
                if not source_file.exists() or db.scalar(select(Artwork).where(Artwork.episode_id == episode.id, Artwork.kind == kind)):
                    continue
                data = source_file.read_bytes()
                path = storage.save(f"episodes/{episode.id}/{kind}.jpg", data)
                width, height = ARTWORK_DIMENSIONS[kind]
                db.add(Artwork(episode_id=episode.id, kind=kind, path=path, width=width, height=height, size_bytes=len(data)))
        db.commit()
    finally: db.close()
    return len(rows)

if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "seed_shows.json"
    print(f"Imported {seed(source)} episode rows")
