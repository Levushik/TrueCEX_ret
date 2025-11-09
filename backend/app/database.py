"""
Database configuration and session management
SQLAlchemy setup for database connections
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

# Database URL for SQLite
DATABASE_URL = "sqlite:///./true.db"

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=False)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Database session dependency for FastAPI
    Yields a database session and automatically closes it after use
    This will be used with Depends(get_db) in FastAPI endpoints
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create all tables on module import
Base.metadata.create_all(bind=engine)
