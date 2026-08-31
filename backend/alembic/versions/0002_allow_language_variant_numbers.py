"""Allow language variants to share an episode number."""
from alembic import op
import sqlalchemy as sa

revision = "0002_allow_variant_numbers"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade():
    inspector = sa.inspect(op.get_bind())
    for constraint in inspector.get_unique_constraints("episodes"):
        columns = constraint.get("column_names") or []
        if columns == ["season_id", "number"]:
            op.drop_constraint(constraint["name"], "episodes", type_="unique")

def downgrade():
    op.create_unique_constraint("uq_episode_season_number", "episodes", ["season_id", "number"])
