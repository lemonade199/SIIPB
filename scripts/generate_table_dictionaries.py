"""Extract schema dictionary directly from live MariaDB information_schema."""
import sys
from pathlib import Path
root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir / "backend"))

from app.database import SessionLocal
from sqlalchemy import text

def get_all_tables_metadata():
    session = SessionLocal()
    tables_res = session.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema='siipb' ORDER BY table_name")
    ).fetchall()
    tables = [t[0] for t in tables_res]
    
    schema_dict = {}
    for t in tables:
        cols_res = session.execute(
            text("""
                SELECT 
                    column_name, 
                    column_type, 
                    is_nullable, 
                    column_key, 
                    column_default, 
                    extra 
                FROM information_schema.columns 
                WHERE table_schema = 'siipb' AND table_name = :tname 
                ORDER BY ordinal_position
            """),
            {"tname": t}
        ).fetchall()
        
        fk_res = session.execute(
            text("""
                SELECT 
                    column_name, 
                    referenced_table_name, 
                    referenced_column_name 
                FROM information_schema.key_column_usage 
                WHERE table_schema = 'siipb' AND table_name = :tname AND referenced_table_name IS NOT NULL
            """),
            {"tname": t}
        ).fetchall()
        
        schema_dict[t] = {
            "columns": cols_res,
            "foreign_keys": fk_res
        }
    session.close()
    return schema_dict

if __name__ == "__main__":
    data = get_all_tables_metadata()
    print(f"Extracted metadata for {len(data)} tables.")
    for t, info in list(data.items())[:3]:
        print(f"Table {t}: {len(info['columns'])} cols, {len(info['foreign_keys'])} FKs")
