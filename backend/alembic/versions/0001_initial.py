"""Create the Peblo catalogue schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Existing demo volumes were created with SQLAlchemy create_all before Alembic
    # was introduced. Treat a complete existing schema as the initial baseline.
    if sa.inspect(op.get_bind()).has_table("shows"):
        return
    op.create_table("shows", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("title", sa.String(200), nullable=False), sa.Column("slug", sa.String(200), nullable=False), sa.Column("synopsis", sa.Text(), nullable=False), sa.Column("section", sa.String(40)), sa.Column("categories", sa.JSON(), nullable=False), sa.Column("status", sa.String(20), nullable=False))
    op.create_index("ix_shows_title", "shows", ["title"]); op.create_index("ix_shows_slug", "shows", ["slug"], unique=True); op.create_index("ix_shows_section", "shows", ["section"]); op.create_index("ix_shows_status", "shows", ["status"])
    op.create_table("seasons", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("show_id", sa.Integer(), sa.ForeignKey("shows.id", ondelete="CASCADE"), nullable=False), sa.Column("number", sa.Integer(), nullable=False), sa.Column("title", sa.String(200), nullable=False), sa.UniqueConstraint("show_id", "number"))
    op.create_index("ix_seasons_show_id", "seasons", ["show_id"])
    op.create_table("episodes", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("external_id", sa.String(100), unique=True), sa.Column("season_id", sa.Integer(), sa.ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False), sa.Column("number", sa.Integer(), nullable=False), sa.Column("title", sa.String(200), nullable=False), sa.Column("duration_seconds", sa.Integer()), sa.Column("language", sa.String(10), nullable=False), sa.Column("content_group", sa.String(150), nullable=False), sa.Column("status", sa.String(20), nullable=False))
    op.create_index("ix_episodes_season_id", "episodes", ["season_id"]); op.create_index("ix_episodes_content_group", "episodes", ["content_group"]); op.create_index("ix_episodes_status", "episodes", ["status"])
    op.create_table("artwork", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("episode_id", sa.Integer(), sa.ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False), sa.Column("kind", sa.String(20), nullable=False), sa.Column("path", sa.String(500), nullable=False), sa.Column("width", sa.Integer(), nullable=False), sa.Column("height", sa.Integer(), nullable=False), sa.Column("size_bytes", sa.Integer(), nullable=False), sa.UniqueConstraint("episode_id", "kind"))
    op.create_index("ix_artwork_episode_id", "artwork", ["episode_id"])
    op.create_table("publish_runs", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("actor", sa.String(100), nullable=False), sa.Column("started_at", sa.DateTime(), nullable=False), sa.Column("finished_at", sa.DateTime()), sa.Column("show_count", sa.Integer(), nullable=False), sa.Column("episode_count", sa.Integer(), nullable=False), sa.Column("outcome", sa.String(20), nullable=False), sa.Column("error", sa.Text()))

def downgrade():
    op.drop_table("publish_runs"); op.drop_table("artwork"); op.drop_table("episodes"); op.drop_table("seasons"); op.drop_table("shows")
