import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()


def _build_database_url() -> str:
    """Resolve DB URL from env (SQLite dev, MySQL prod, Postgres on Railway)."""
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("mysql://"):
            url = url.replace("mysql://", "mysql+pymysql://", 1)
        return url

    mysql_host = os.getenv("MYSQLHOST") or os.getenv("MYSQL_HOST")
    if mysql_host:
        user = os.getenv("MYSQLUSER") or os.getenv("MYSQL_USER", "root")
        password = os.getenv("MYSQLPASSWORD") or os.getenv("MYSQL_PASSWORD", "")
        port = os.getenv("MYSQLPORT") or os.getenv("MYSQL_PORT", "3306")
        database = os.getenv("MYSQLDATABASE") or os.getenv("MYSQL_DATABASE", "railway")
        safe_pass = quote_plus(password)
        return f"mysql+pymysql://{user}:{safe_pass}@{mysql_host}:{port}/{database}"

    return "sqlite:///./taskmanager.db"


DATABASE_URL = _build_database_url()

connect_args = {}
engine_kwargs = {"pool_pre_ping": True}
if "sqlite" in DATABASE_URL:
    connect_args["check_same_thread"] = False
    engine_kwargs.pop("pool_pre_ping", None)

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
