from pydantic import BaseModel, Field
from pydantic import field_validator

SECTIONS = {"featured", "series", "minisodes", "songs"}
CATEGORIES = {"adventure", "folk", "friendship", "india", "language", "learning", "maths", "music", "nature", "reading", "science", "singalong", "stories", "travel", "values"}
LANGUAGES = {"en", "hi"}

def valid_status(value: str) -> str:
    if value not in {"draft", "published"}: raise ValueError("status must be draft or published")
    return value

class ShowIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    synopsis: str = ""
    section: str | None = None
    categories: list[str] = Field(default_factory=list)
    status: str = "draft"

    @field_validator("section")
    @classmethod
    def section_allowed(cls, value):
        if value is not None and value not in SECTIONS: raise ValueError("section must be featured, series, minisodes, or songs")
        return value
    _status = field_validator("status")(valid_status)
    @field_validator("categories")
    @classmethod
    def categories_allowed(cls, values):
        invalid = sorted(set(values) - CATEGORIES)
        if invalid: raise ValueError(f"Unknown categories: {', '.join(invalid)}")
        return values

class SeasonIn(BaseModel):
    number: int = Field(ge=0)
    title: str = ""

class EpisodeIn(BaseModel):
    external_id: str | None = None
    number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    duration_seconds: int | None = Field(default=None, ge=1)
    language: str = "en"
    content_group: str = Field(min_length=1)
    status: str = "draft"

    @field_validator("language")
    @classmethod
    def language_allowed(cls, value):
        if value not in LANGUAGES: raise ValueError("language must be en or hi")
        return value
    _status = field_validator("status")(valid_status)

def show_out(x):
    return {"id": x.id, "title": x.title, "slug": x.slug, "synopsis": x.synopsis, "section": x.section, "categories": x.categories, "status": x.status}

def season_out(x):
    return {"id": x.id, "show_id": x.show_id, "number": x.number, "title": x.title}

def episode_out(x):
    return {"id": x.id, "external_id": x.external_id, "season_id": x.season_id, "number": x.number, "title": x.title, "duration_seconds": x.duration_seconds, "language": x.language, "content_group": x.content_group, "status": x.status, "artwork": [{"kind": a.kind, "url": f"/artwork/{a.path}"} for a in x.artwork]}
