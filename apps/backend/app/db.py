from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "dev.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

# 새로 붙일 컬럼에만 쓰는 SQLite 타입 이름. 필요한 것만 둔다.
_SQL_TYPES = {"INTEGER", "VARCHAR", "TEXT", "FLOAT", "BOOLEAN", "DATETIME", "JSON"}


def _add_missing_columns() -> None:
    """모델에 새로 생긴 컬럼을 기존 테이블에 붙인다.

    이 저장소는 마이그레이션 도구를 쓰지 않는다(`create_all` 만 돈다). 그래서 모델에
    필드를 추가하면 기존 `dev.db` 에는 컬럼이 없어 `no such column` 으로 죽는다.
    DB 를 지우면 해결되지만 촬영용 시드와 수집 결과가 함께 사라진다.

    NOT NULL 이나 복잡한 기본값이 필요한 변경은 다루지 않는다. SQLite 의 ADD COLUMN
    제약이 까다롭고, 그 정도 변경이면 마이그레이션 도구를 들이는 편이 맞다.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as connection:
        for table in SQLModel.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            present = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in present:
                    continue
                type_name = column.type.compile(engine.dialect).split("(")[0].upper()
                if type_name not in _SQL_TYPES:
                    continue
                clause = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {type_name}'
                default = column.default.arg if column.default is not None else None
                if isinstance(default, str):
                    clause += f" DEFAULT '{default}'"
                elif isinstance(default, (int, float)) and not isinstance(default, bool):
                    clause += f" DEFAULT {default}"
                connection.execute(text(clause))


def init_db() -> None:
    from app import models  # noqa: F401  테이블 등록

    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def get_session():
    with Session(engine) as session:
        yield session
