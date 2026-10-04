import os
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, DateTime, JSON, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session

logger = logging.getLogger("memorydesk.db")

# Load environment variables
ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"
BACKEND_ENV = Path(__file__).resolve().parent.parent / ".env"
if BACKEND_ENV.exists():
    load_dotenv(BACKEND_ENV, override=True)
elif ROOT_ENV.exists():
    load_dotenv(ROOT_ENV, override=True)
load_dotenv(override=True)

Base = declarative_base()
JSON_COLUMN_TYPE = JSONB().with_variant(JSON(), "sqlite")


class MemoryModel(Base):
    __tablename__ = "memories"
    id = Column(String, primary_key=True)
    data = Column(JSON_COLUMN_TYPE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class IncidentModel(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True)
    data = Column(JSON_COLUMN_TYPE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


engine = None
SessionLocal = None
DB_CONNECTED = False
DB_INIT_ATTEMPTED = False


def get_database_url() -> Optional[str]:
    raw_url = os.getenv("DATABASE_URL", "").strip()
    if not raw_url:
        return None
    # Normalize postgres:// to postgresql:// for SQLAlchemy compatibility
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)

    # Sanitize password if bracketed (e.g. [password]) or contains unencoded special chars
    if "://" in raw_url and "@" in raw_url:
        try:
            import urllib.parse
            scheme, rest = raw_url.split("://", 1)
            last_at = rest.rfind("@")
            userpass = rest[:last_at]
            host_part = rest[last_at + 1:]
            if ":" in userpass:
                user, password = userpass.split(":", 1)
                if password.startswith("[") and password.endswith("]"):
                    password = password[1:-1]
                clean_pass = urllib.parse.quote_plus(password)
                raw_url = f"{scheme}://{user}:{clean_pass}@{host_part}"
        except Exception:
            pass

    return raw_url


def init_db() -> bool:
    global engine, SessionLocal, DB_CONNECTED, DB_INIT_ATTEMPTED
    if DB_INIT_ATTEMPTED and DB_CONNECTED:
        return True
    DB_INIT_ATTEMPTED = True

    raw_url = get_database_url()
    if not raw_url:
        logger.warning("[DATABASE] DATABASE_URL not set. Operating in resilient JSON/in-memory fallback mode.")
        DB_CONNECTED = False
        return False

    connect_args: Dict[str, Any] = {}
    is_sqlite = raw_url.startswith("sqlite")

    if is_sqlite:
        connect_args["check_same_thread"] = False
    else:
        connect_args["connect_timeout"] = 5
        # Supabase and remote PostgreSQL require SSL
        if "localhost" not in raw_url and "127.0.0.1" not in raw_url:
            if "sslmode" not in raw_url:
                connect_args["sslmode"] = "require"

    try:
        engine = create_engine(
            raw_url,
            connect_args=connect_args,
            pool_pre_ping=True,
            **({} if is_sqlite else {"pool_size": 5, "max_overflow": 10})
        )
        # Verify connectivity
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))

        # Create tables if not exist
        Base.metadata.create_all(bind=engine)
        SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
        DB_CONNECTED = True
        logger.info("[DATABASE] Successfully connected to PostgreSQL/database. Persistence active.")
        return True
    except Exception as e:
        logger.warning(
            f"[DATABASE] Database connection failed ({type(e).__name__}: {e}). "
            "Transparently falling back to local JSON/in-memory persistence."
        )
        engine = None
        SessionLocal = None
        DB_CONNECTED = False
        return False


def is_db_connected() -> bool:
    return DB_CONNECTED


def seed_memories_db(seed_records: List[Dict[str, Any]]) -> int:
    if not is_db_connected() or not SessionLocal:
        return 0
    session = SessionLocal()
    inserted_count = 0
    try:
        existing_rows = session.query(MemoryModel.id).all()
        existing_ids = {r[0] for r in existing_rows}

        for item in seed_records:
            mem_id = item.get("id")
            if not mem_id or mem_id in existing_ids:
                continue

            created_time = datetime.utcnow()
            if item.get("created_at"):
                try:
                    created_time = datetime.fromisoformat(item["created_at"])
                except Exception:
                    pass

            session.add(MemoryModel(
                id=mem_id,
                data=item,
                created_at=created_time
            ))
            existing_ids.add(mem_id)
            inserted_count += 1

        if inserted_count > 0:
            session.commit()
            logger.info(f"[DATABASE] Seeded {inserted_count} initial memories into database.")
        return inserted_count
    except Exception as e:
        session.rollback()
        logger.warning(f"[DATABASE] Failed to seed memories: {e}")
        return 0
    finally:
        session.close()


def save_memory_db(memory_record: Dict[str, Any]) -> bool:
    if not is_db_connected() or not SessionLocal:
        return False
    mem_id = memory_record.get("id")
    if not mem_id:
        return False
    session = SessionLocal()
    try:
        created_time = datetime.utcnow()
        if memory_record.get("created_at"):
            try:
                created_time = datetime.fromisoformat(memory_record["created_at"])
            except Exception:
                pass

        session.merge(MemoryModel(
            id=mem_id,
            data=memory_record,
            created_at=created_time
        ))
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.warning(f"[DATABASE] Failed to save memory {mem_id} to database: {e}")
        return False
    finally:
        session.close()


def load_memories_db() -> List[Dict[str, Any]]:
    if not is_db_connected() or not SessionLocal:
        return []
    session = SessionLocal()
    try:
        rows = session.query(MemoryModel).order_by(MemoryModel.created_at.asc()).all()
        return [row.data for row in rows if row.data]
    except Exception as e:
        logger.warning(f"[DATABASE] Failed to load memories from database: {e}")
        return []
    finally:
        session.close()


def save_incident_db(incident_record: Dict[str, Any]) -> bool:
    if not is_db_connected() or not SessionLocal:
        return False
    inc_id = incident_record.get("id")
    if not inc_id:
        return False
    session = SessionLocal()
    try:
        now = datetime.utcnow()
        created_time = now
        if incident_record.get("created_at"):
            try:
                created_time = datetime.fromisoformat(incident_record["created_at"])
            except Exception:
                pass

        session.merge(IncidentModel(
            id=inc_id,
            data=incident_record,
            created_at=created_time,
            updated_at=now
        ))
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.warning(f"[DATABASE] Failed to save incident {inc_id} to database: {e}")
        return False
    finally:
        session.close()


def load_incidents_db() -> List[Dict[str, Any]]:
    if not is_db_connected() or not SessionLocal:
        return []
    session = SessionLocal()
    try:
        rows = session.query(IncidentModel).order_by(IncidentModel.created_at.asc()).all()
        return [row.data for row in rows if row.data]
    except Exception as e:
        logger.warning(f"[DATABASE] Failed to load incidents from database: {e}")
        return []
    finally:
        session.close()
