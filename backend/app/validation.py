from collections import defaultdict
from sqlalchemy import select
from .models import Show, Episode

def validation_report(db):
    issues = defaultdict(list)
    for show in db.scalars(select(Show)).all():
        if show.status == "published" and not show.section: issues["shows"].append({"id": show.id, "message": "Published show needs a section."})
        for season in show.seasons:
            for ep in season.episodes:
                if ep.status == "published":
                    if not ep.duration_seconds: issues["episodes"].append({"id": ep.id, "message": "Published episode needs a duration."})
                    if not ep.artwork: issues["episodes"].append({"id": ep.id, "message": "Published episode needs artwork."})
    groups = defaultdict(list)
    for ep in db.scalars(select(Episode)).all(): groups[(ep.content_group, ep.language)].append(ep.id)
    for (group, language), ids in groups.items():
        if len(ids) > 1: issues["duplicates"].append({"content_group": group, "language": language, "episode_ids": ids, "message": "content_group and language must be unique."})
    return {"blocking": bool(issues), "issues": dict(issues)}
