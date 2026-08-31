import json
from collections import defaultdict
from sqlalchemy import select
from .models import Show

def build_catalog(db):
    sections = defaultdict(list)
    shows = db.scalars(select(Show).where(Show.status == "published").order_by(Show.title, Show.id)).all()
    for show in shows:
        seasons = []
        for season in sorted(show.seasons, key=lambda s: s.number):
            if season.number == 0: continue
            grouped = {}
            for ep in sorted(season.episodes, key=lambda e: (e.number, e.title, e.language, e.id)):
                if ep.status != "published": continue
                item = grouped.setdefault(ep.content_group, {"episode_number": ep.number, "title": ep.title, "duration_seconds": ep.duration_seconds, "languages": [], "artwork": {}})
                item["languages"].append(ep.language)
                for art in ep.artwork: item["artwork"][art.kind] = f"/artwork/{art.path}"
            seasons.append({"number": season.number, "title": season.title, "episodes": list(grouped.values())})
        sections[show.section].append({"slug": show.slug, "title": show.title, "synopsis": show.synopsis, "categories": sorted(show.categories or []), "seasons": seasons})
    return {"sections": [{"name": name, "shows": sections[name]} for name in sorted(sections)]}

def catalog_bytes(db):
    return json.dumps(build_catalog(db), sort_keys=True, separators=(",", ":")).encode()
