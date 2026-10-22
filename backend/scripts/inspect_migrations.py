import re
from pathlib import Path

alembic_dir = Path('backend/alembic/versions')
files = [   
    'f627cba678a2_create_initial_schema_26_tables.py',
    'a7c3e91d2b40_fullstack_plan_features.py',
    'c1f9e2b8a341_simplify_database_tables.py',
    'd4e8b1a5f920_consolidate_role_permissions_into_roles_json.py'
]

for fname in files:
    f = alembic_dir / fname
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    
    # Split upgrade and downgrade
    parts = re.split(r'def downgrade\(\)', content)
    upgrade_part = parts[0]
    downgrade_part = parts[1] if len(parts) > 1 else ""

    created = re.findall(r"op\.create_table\(\s*['\"]([^'\"]+)['\"]", upgrade_part)
    dropped = re.findall(r"op\.drop_table\(\s*['\"]([^'\"]+)['\"]", upgrade_part)
    added_cols = re.findall(r"op\.add_column\(\s*['\"]([^'\"]+)['\"],\s*sa\.Column\(['\"]([^'\"]+)['\"]", upgrade_part)
    dropped_cols = re.findall(r"op\.drop_column\(\s*['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"]", upgrade_part)
    
    rev = re.search(r"revision:\s*str\s*=\s*['\"]([^'\"]+)['\"]", content)
    down = re.search(r"down_revision:[^=]*=\s*['\"]?([^'\"\n]+)['\"]?", content)
    date = re.search(r"Create Date:\s*([^\n]+)", content)
    
    print(f"=== MIGRATION: {rev.group(1) if rev else None} ===")
    print(f"File: {fname}")
    print(f"Date: {date.group(1).strip() if date else None}")
    print(f"Down Revision: {down.group(1) if down else None}")
    print(f"Tables CREATED in upgrade ({len(created)}): {created}")
    print(f"Tables DROPPED in upgrade ({len(dropped)}): {dropped}")
    print(f"Columns ADDED in upgrade: {added_cols}")
    print(f"Columns DROPPED in upgrade: {dropped_cols}")
    print()
