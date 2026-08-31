"""Import the challenge's flat seed_shows.json into the normalized schema."""
import json
from pathlib import Path
import sys
from sqlalchemy import select
from .db import Base, SessionLocal, engine
from .models import Episode, Season, Show

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
            if not db.scalar(select(Episode).where(Episode.external_id == row["episode_id"])):
                db.add(Episode(external_id=row["episode_id"], season_id=season.id, number=row["episode_number"], title=row["episode_title"], duration_seconds=row.get("duration_seconds"), language=row.get("language", "en"), content_group=row["content_group"], status=row.get("status", "draft")))
        db.commit()
    finally: db.close()
    return len(rows)

if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "seed_shows.json"
    print(f"Imported {seed(source)} episode rows")
