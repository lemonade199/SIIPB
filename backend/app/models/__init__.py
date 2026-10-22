"""Semua model diimpor di sini agar Base.metadata mengenal seluruh tabel (dibutuhkan Alembic)."""
from app.models.base import Base
from app.models.organizational_unit import OrganizationalUnit
from app.models.user import User
from app.models.role import Role, RolePermission
from app.models.permission import Permission
from app.models.auth import RefreshToken
from app.models.borrower import Borrower
from app.models.category import Category
from app.models.location import Location
from app.models.asset import Asset, AssetHistory, AssetPhoto
from app.models.borrowing import Borrowing, BorrowingItem
from app.models.asset_return import Return, ReturnItem
from app.models.asset_incident_report import AssetIncidentReport, DamageReport, LossReport
from app.models.notification_template import NotificationTemplate
from app.models.notification_event import NotificationEvent
from app.models.notification import Notification, NotificationRead
from app.models.notification_delivery import NotificationDelivery, EmailDelivery
from app.models.audit_log import AuditLog
from app.models.system_setting import SystemSetting
from app.models.scheduler_run import SchedulerRun
from app.models.enums import (
    AssetCondition,
    AssetStatus,
    BorrowingStatus,
    DamageSeverity,
    EmailDeliveryStatus,
    NotificationChannel,
    NotificationEventCode,
    NotificationEventStatus,
    NotificationStatus,
    RecipientType,
    RepairStatus,
    ReturnCondition,
    SettingValueType,
)

__all__ = [
    "Base",
    "OrganizationalUnit",
    "User",
    "Role",
    "RolePermission",
    "Permission",
    "RefreshToken",
    "Borrower",
    "Category",
    "Location",
    "Asset",
    "AssetHistory",
    "Borrowing",
    "BorrowingItem",
    "Return",
    "ReturnItem",
    "AssetIncidentReport",
    "DamageReport",
    "LossReport",
    "NotificationTemplate",
    "NotificationEvent",
    "Notification",
    "NotificationDelivery",
    "EmailDelivery",
    "AuditLog",
    "SystemSetting",
    "AssetPhoto",
    "NotificationRead",
    "SchedulerRun",
    "RecipientType",
]
