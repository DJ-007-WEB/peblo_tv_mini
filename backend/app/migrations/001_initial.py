"""Initial schema migration entry point for environments without Alembic."""
from ..db import Base, engine

def upgrade():
    Base.metadata.create_all(engine)

def downgrade():
    Base.metadata.drop_all(engine)
