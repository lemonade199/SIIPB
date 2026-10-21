"""consolidate role_permissions and permissions into roles.permissions JSON

Revision ID: d4e8b1a5f920
Revises: c1f9e2b8a341
Create Date: 2026-10-19 11:35:00.000000
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from app.models.permission import SYSTEM_PERMISSIONS

revision: str = 'd4e8b1a5f920'
down_revision: Union[str, None] = 'c1f9e2b8a341'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    roles_cols = [c['name'] for c in inspector.get_columns('roles')]
    if 'permissions' not in roles_cols:
        op.add_column('roles', sa.Column('permissions', sa.JSON(), nullable=True))

    # Migrasi data relasi role_permissions ke roles.permissions
    if 'role_permissions' in tables and 'permissions' in tables:
        rows = conn.execute(sa.text("""
            SELECT rp.role_id, p.code
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            ORDER BY rp.role_id, p.code
        """)).fetchall()

        role_perms_map: dict[int, list[str]] = {}
        for role_id, code in rows:
            role_perms_map.setdefault(role_id, []).append(code)

        role_ids = [r[0] for r in conn.execute(sa.text("SELECT id FROM roles")).fetchall()]
        for rid in role_ids:
            perms_list = role_perms_map.get(rid, [])
            conn.execute(
                sa.text("UPDATE roles SET permissions = :perms WHERE id = :rid"),
                {"perms": json.dumps(perms_list), "rid": rid}
            )

    # Fallback jika ada role bernilai NULL
    conn.execute(sa.text("UPDATE roles SET permissions = '[]' WHERE permissions IS NULL"))

    op.alter_column(
        'roles',
        'permissions',
        existing_type=sa.JSON(),
        nullable=False,
        server_default=sa.text("'[]'")
    )

    if 'role_permissions' in tables:
        op.drop_table('role_permissions')
    if 'permissions' in tables:
        op.drop_table('permissions')


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'permissions' not in tables:
        op.create_table(
            'permissions',
            sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
            sa.Column('code', sa.String(length=100), nullable=False),
            sa.Column('name', sa.String(length=150), nullable=False),
            sa.Column('module', sa.String(length=50), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_permissions')),
            sa.UniqueConstraint('code', name=op.f('uq_permissions_code')),
            mysql_charset='utf8mb4',
            mysql_collate='utf8mb4_unicode_ci',
            mysql_engine='InnoDB'
        )
        op.create_index(op.f('ix_permissions_module'), 'permissions', ['module'], unique=False)

    for item in SYSTEM_PERMISSIONS:
        conn.execute(
            sa.text("""
                INSERT INTO permissions (id, code, name, module, description)
                VALUES (:id, :code, :name, :module, :description)
                ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module), description = VALUES(description)
            """),
            {
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "module": item.module,
                "description": item.description,
            }
        )

    if 'role_permissions' not in tables:
        op.create_table(
            'role_permissions',
            sa.Column('role_id', mysql.BIGINT(unsigned=True), nullable=False),
            sa.Column('permission_id', mysql.BIGINT(unsigned=True), nullable=False),
            sa.Column('created_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
            sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], name=op.f('fk_role_permissions_permission_id_permissions'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_role_permissions_role_id_roles'), ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('role_id', 'permission_id', name=op.f('pk_role_permissions')),
            mysql_charset='utf8mb4',
            mysql_collate='utf8mb4_unicode_ci',
            mysql_engine='InnoDB'
        )
        op.create_index(op.f('ix_role_permissions_permission_id'), 'role_permissions', ['permission_id'], unique=False)

    # Pulihkan data relasi role_permissions dari JSON roles.permissions
    perm_code_to_id = {
        row[0]: row[1]
        for row in conn.execute(sa.text("SELECT code, id FROM permissions")).fetchall()
    }
    roles = conn.execute(sa.text("SELECT id, permissions FROM roles")).fetchall()
    for rid, perms_json in roles:
        if perms_json:
            perms = json.loads(perms_json) if isinstance(perms_json, str) else perms_json
            for p_code in perms:
                pid = perm_code_to_id.get(p_code)
                if pid:
                    conn.execute(
                        sa.text("""
                            INSERT IGNORE INTO role_permissions (role_id, permission_id)
                            VALUES (:rid, :pid)
                        """),
                        {"rid": rid, "pid": pid}
                    )

    roles_cols = [c['name'] for c in inspector.get_columns('roles')]
    if 'permissions' in roles_cols:
        op.drop_column('roles', 'permissions')
