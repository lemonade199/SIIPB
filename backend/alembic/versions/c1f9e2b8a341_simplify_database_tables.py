"""simplify database tables: consolidate incident reports, notification deliveries, google oauth into users, and user roles into users.role_id

Revision ID: c1f9e2b8a341
Revises: a7c3e91d2b40
Create Date: 2026-10-19 10:05:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = 'c1f9e2b8a341'
down_revision: Union[str, None] = 'a7c3e91d2b40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Tabel asset_incident_reports (gabungan damage & loss)
    op.create_table(
        'asset_incident_reports',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('return_item_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('reported_by', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('incident_type', sa.String(length=30), nullable=False),
        sa.Column('severity', sa.String(length=30), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('evidence_path', sa.String(length=500), nullable=True),
        sa.Column('action_taken', sa.Text(), nullable=True),
        sa.Column('repair_status', sa.String(length=30), server_default=sa.text("'DILAPORKAN'"), nullable=False),
        sa.Column('repair_cost', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('reported_at', mysql.DATETIME(fsp=6), nullable=False),
        sa.Column('resolved_at', mysql.DATETIME(fsp=6), nullable=True),
        sa.Column('created_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.Column('updated_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.CheckConstraint("incident_type IN ('KERUSAKAN', 'KEHILANGAN')", name='ck_asset_incident_reports_incident_type'),
        sa.CheckConstraint("severity IS NULL OR severity IN ('RINGAN', 'SEDANG', 'BERAT')", name='ck_asset_incident_reports_severity'),
        sa.CheckConstraint("repair_status IN ('DILAPORKAN', 'DALAM_PERBAIKAN', 'SELESAI', 'TIDAK_DAPAT_DIPERBAIKI')", name='ck_asset_incident_reports_repair_status'),
        sa.CheckConstraint('repair_cost IS NULL OR repair_cost >= 0', name='ck_asset_incident_reports_repair_cost_non_negative'),
        sa.ForeignKeyConstraint(['reported_by'], ['users.id'], name=op.f('fk_asset_incident_reports_reported_by_users'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['return_item_id'], ['return_items.id'], name=op.f('fk_asset_incident_reports_return_item_id_return_items'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_asset_incident_reports')),
        sa.UniqueConstraint('return_item_id', 'incident_type', name='uq_asset_incident_reports_return_item_id_incident_type'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_asset_incident_reports_incident_type'), 'asset_incident_reports', ['incident_type'], unique=False)
    op.create_index(op.f('ix_asset_incident_reports_repair_status'), 'asset_incident_reports', ['repair_status'], unique=False)
    op.create_index(op.f('ix_asset_incident_reports_reported_at'), 'asset_incident_reports', ['reported_at'], unique=False)
    op.create_index(op.f('ix_asset_incident_reports_reported_by'), 'asset_incident_reports', ['reported_by'], unique=False)
    op.create_index(op.f('ix_asset_incident_reports_return_item_id'), 'asset_incident_reports', ['return_item_id'], unique=False)

    # Migrasi data damage_reports & loss_reports ke asset_incident_reports
    conn.execute(sa.text("""
        INSERT INTO asset_incident_reports (
            return_item_id, reported_by, incident_type, severity, description,
            evidence_path, action_taken, repair_status, repair_cost, reported_at,
            resolved_at, created_at, updated_at
        )
        SELECT
            return_item_id, reported_by, 'KERUSAKAN', severity, description,
            evidence_path, action_taken, repair_status, repair_cost, reported_at,
            resolved_at, created_at, updated_at
        FROM damage_reports
    """))
    conn.execute(sa.text("""
        INSERT INTO asset_incident_reports (
            return_item_id, reported_by, incident_type, severity, description,
            evidence_path, action_taken, repair_status, repair_cost, reported_at,
            resolved_at, created_at, updated_at
        )
        SELECT
            return_item_id, reported_by, 'KEHILANGAN', NULL, description,
            evidence_path, action_taken, 'DILAPORKAN', NULL, reported_at,
            resolved_at, created_at, updated_at
        FROM loss_reports
    """))

    # Tabel notification_deliveries (gabungan deliveries & logs)
    op.create_table(
        'notification_deliveries',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('notification_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('attempt_number', mysql.INTEGER(unsigned=True), nullable=False),
        sa.Column('channel', sa.String(length=20), server_default=sa.text("'EMAIL'"), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('message_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('attempted_at', mysql.DATETIME(fsp=6), nullable=False),
        sa.Column('delivered_at', mysql.DATETIME(fsp=6), nullable=True),
        sa.CheckConstraint('attempt_number >= 1', name='ck_notification_deliveries_attempt_number_positive'),
        sa.CheckConstraint("status IN ('PENDING', 'SENT', 'FAILED', 'RETRYING')", name='ck_notification_deliveries_status'),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], name=op.f('fk_notification_deliveries_notification_id_notifications'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_notification_deliveries')),
        sa.UniqueConstraint('notification_id', 'attempt_number', name='uq_notification_deliveries_notification_id_attempt_number'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_notification_deliveries_attempted_at'), 'notification_deliveries', ['attempted_at'], unique=False)
    op.create_index(op.f('ix_notification_deliveries_notification_id'), 'notification_deliveries', ['notification_id'], unique=False)
    op.create_index(op.f('ix_notification_deliveries_status'), 'notification_deliveries', ['status'], unique=False)

    # Migrasi data email_deliveries ke notification_deliveries
    conn.execute(sa.text("""
        INSERT INTO notification_deliveries (
            notification_id, attempt_number, channel, provider, message_id,
            status, error_message, attempted_at, delivered_at
        )
        SELECT
            notification_id, attempt_number, 'EMAIL', provider, message_id,
            status, error_message, attempted_at, delivered_at
        FROM email_deliveries
    """))

    # Penambahan kolom role_id & Google SSO pada users
    op.add_column('users', sa.Column('role_id', mysql.BIGINT(unsigned=True), nullable=True))
    op.add_column('users', sa.Column('google_subject', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('google_email', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('google_linked_at', mysql.DATETIME(fsp=6), nullable=True))

    op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)
    op.create_unique_constraint('uq_users_google_subject', 'users', ['google_subject'])
    op.create_foreign_key(op.f('fk_users_role_id_roles'), 'users', 'roles', ['role_id'], ['id'], ondelete='RESTRICT')

    # Migrasi data peran dari user_roles ke users.role_id
    conn.execute(sa.text("""
        UPDATE users u
        INNER JOIN (
            SELECT user_id, MIN(role_id) AS assigned_role_id
            FROM user_roles
            GROUP BY user_id
        ) ur ON u.id = ur.user_id
        SET u.role_id = ur.assigned_role_id
    """))

    # Fallback jika ada pengguna yang belum memiliki role, tetapkan ke role default pertama
    conn.execute(sa.text("""
        UPDATE users
        SET role_id = (SELECT id FROM roles ORDER BY id ASC LIMIT 1)
        WHERE role_id IS NULL
    """))

    op.alter_column('users', 'role_id',
                    existing_type=mysql.BIGINT(unsigned=True),
                    nullable=False)

    # Migrasi data Google SSO dari external_identities ke users
    conn.execute(sa.text("""
        UPDATE users u
        INNER JOIN external_identities ei ON u.id = ei.user_id AND ei.provider = 'google'
        SET u.google_subject = ei.provider_subject,
            u.google_email = ei.email,
            u.google_linked_at = ei.created_at
    """))

    # Hapus tabel lama yang telah digabungkan / dieliminasi
    op.drop_table('damage_reports')
    op.drop_table('loss_reports')
    op.drop_table('notification_logs')
    op.drop_table('email_deliveries')
    op.drop_table('external_identities')
    op.drop_table('user_roles')


def downgrade() -> None:
    conn = op.get_bind()

    op.create_table(
        'user_roles',
        sa.Column('user_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('role_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('assigned_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.Column('assigned_by', mysql.BIGINT(unsigned=True), nullable=True),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], name='fk_user_roles_assigned_by_users', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name='fk_user_roles_role_id_roles', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_user_roles_user_id_users', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'role_id', name='pk_user_roles'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    conn.execute(sa.text("""
        INSERT INTO user_roles (user_id, role_id)
        SELECT id, role_id FROM users WHERE role_id IS NOT NULL
    """))

    op.create_table(
        'external_identities',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('user_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('provider_subject', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('created_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.Column('updated_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_external_identities_user_id_users', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='pk_external_identities'),
        sa.UniqueConstraint('provider', 'provider_subject', name='uq_external_identities_provider_provider_subject'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    conn.execute(sa.text("""
        INSERT INTO external_identities (user_id, provider, provider_subject, email, created_at, updated_at)
        SELECT id, 'google', google_subject, google_email, COALESCE(google_linked_at, CURRENT_TIMESTAMP(6)), CURRENT_TIMESTAMP(6)
        FROM users WHERE google_subject IS NOT NULL
    """))

    op.drop_constraint('fk_users_role_id_roles', 'users', type_='foreignkey')
    op.drop_constraint('uq_users_google_subject', 'users', type_='unique')
    op.drop_index('ix_users_role_id', table_name='users')
    op.drop_column('users', 'google_linked_at')
    op.drop_column('users', 'google_email')
    op.drop_column('users', 'google_subject')
    op.drop_column('users', 'role_id')

    op.create_table(
        'email_deliveries',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('notification_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('attempt_number', mysql.INTEGER(unsigned=True), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('message_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('attempted_at', mysql.DATETIME(fsp=6), nullable=False),
        sa.Column('delivered_at', mysql.DATETIME(fsp=6), nullable=True),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], name='fk_email_deliveries_notification_id_notifications', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_email_deliveries'),
        sa.UniqueConstraint('notification_id', 'attempt_number', name='uq_email_deliveries_notification_id_attempt_number'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    conn.execute(sa.text("""
        INSERT INTO email_deliveries (notification_id, attempt_number, provider, message_id, status, error_message, attempted_at, delivered_at)
        SELECT notification_id, attempt_number, provider, message_id, status, error_message, attempted_at, delivered_at
        FROM notification_deliveries
    """))

    op.create_table(
        'notification_logs',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('notification_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], name='fk_notification_logs_notification_id_notifications', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_notification_logs'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )

    op.drop_table('notification_deliveries')

    op.create_table(
        'damage_reports',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('return_item_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('reported_by', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('severity', sa.String(length=30), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('evidence_path', sa.String(length=500), nullable=True),
        sa.Column('action_taken', sa.Text(), nullable=True),
        sa.Column('repair_status', sa.String(length=30), server_default=sa.text("'DILAPORKAN'"), nullable=False),
        sa.Column('repair_cost', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('reported_at', mysql.DATETIME(fsp=6), nullable=False),
        sa.Column('resolved_at', mysql.DATETIME(fsp=6), nullable=True),
        sa.Column('created_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.Column('updated_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.ForeignKeyConstraint(['reported_by'], ['users.id'], name='fk_damage_reports_reported_by_users', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['return_item_id'], ['return_items.id'], name='fk_damage_reports_return_item_id_return_items', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_damage_reports'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    conn.execute(sa.text("""
        INSERT INTO damage_reports (
            return_item_id, reported_by, severity, description, evidence_path,
            action_taken, repair_status, repair_cost, reported_at, resolved_at,
            created_at, updated_at
        )
        SELECT
            return_item_id, reported_by, COALESCE(severity, 'RINGAN'), description, evidence_path,
            action_taken, repair_status, repair_cost, reported_at, resolved_at,
            created_at, updated_at
        FROM asset_incident_reports WHERE incident_type = 'KERUSAKAN'
    """))

    op.create_table(
        'loss_reports',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('return_item_id', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('reported_by', mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('evidence_path', sa.String(length=500), nullable=True),
        sa.Column('action_taken', sa.Text(), nullable=True),
        sa.Column('reported_at', mysql.DATETIME(fsp=6), nullable=False),
        sa.Column('resolved_at', mysql.DATETIME(fsp=6), nullable=True),
        sa.Column('created_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.Column('updated_at', mysql.DATETIME(fsp=6), server_default=sa.text('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'), nullable=False),
        sa.ForeignKeyConstraint(['reported_by'], ['users.id'], name='fk_loss_reports_reported_by_users', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['return_item_id'], ['return_items.id'], name='fk_loss_reports_return_item_id_return_items', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_loss_reports'),
        sa.UniqueConstraint('return_item_id', name='uq_loss_reports_return_item_id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    conn.execute(sa.text("""
        INSERT INTO loss_reports (
            return_item_id, reported_by, description, evidence_path, action_taken,
            reported_at, resolved_at, created_at, updated_at
        )
        SELECT
            return_item_id, reported_by, description, evidence_path, action_taken,
            reported_at, resolved_at, created_at, updated_at
        FROM asset_incident_reports WHERE incident_type = 'KEHILANGAN'
    """))

    op.drop_table('asset_incident_reports')
