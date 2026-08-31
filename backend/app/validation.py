from collections import defaultdict
from sqlalchemy import select
from .models import Show, Episode

def validation_report(db):
    issues = defaultdict(list)
    for show in db.scalars(select(Show).order_by(Show.id)).all():
        context = {"show_id": show.id, "show_title": show.title}
        if show.status == "published" and not show.section:
            issues["shows"].append({**context, "code": "missing_section", "message": "Published show needs a section.", "fix": "Choose a section for this show."})
        for season in show.seasons:
            for ep in season.episodes:
                if ep.status == "published":
                    context = {"id": ep.id, "show_id": show.id, "show_title": show.title, "season_id": season.id, "season_number": season.number, "episode_title": ep.title}
                    if not ep.duration_seconds: issues["episodes"].append({**context, "code": "missing_duration", "message": "Published episode needs a duration.", "fix": "Add the episode duration."})
                    if not ep.artwork: issues["episodes"].append({**context, "code": "missing_artwork", "message": "Published episode needs artwork.", "fix": "Upload artwork for this episode."})
    groups = defaultdict(list)
    for ep in db.scalars(select(Episode)).all(): groups[(ep.content_group, ep.language)].append(ep.id)
    for (group, language), ids in sorted(groups.items()):
        if len(ids) > 1: issues["duplicates"].append({"content_group": group, "language": language, "episode_ids": ids, "code": "duplicate_variant", "message": "content_group and language must be unique.", "fix": "Change the content group or language on one episode."})
    return {"blocking": bool(issues), "issues": dict(issues)}
