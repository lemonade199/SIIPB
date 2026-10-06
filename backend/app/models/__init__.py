"""Import every model so Base.metadata knows all 26 tables (needed by Alembic)."""
from app.models.base import Base
from app.models.organizational_unit import OrganizationalUnit
from app.models.user import User, UserRole
from app.models.role import Role, RolePermission
from app.models.permission import Permission
from app.models.auth import ExternalIdentity, RefreshToken
from app.models.borrower import Borrower
from app.models.category import Category
from app.models.location import Location
from app.models.asset import Asset, AssetHistory
from app.models.borrowing import Borrowing, BorrowingItem
from app.models.asset_return import Return, ReturnItem
from app.models.damage_report import DamageReport
from app.models.loss_report import LossReport
from app.models.notification_template import NotificationTemplate
from app.models.notification_event import NotificationEvent
from app.models.notification import Notification
from app.models.notification_log import NotificationLog
from app.models.email_delivery import EmailDelivery
from app.models.audit_log import AuditLog
from app.models.system_setting import SystemSetting
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
    RepairStatus,
    ReturnCondition,
    SettingValueType,
)

__all__ = [
    "Base",
    "OrganizationalUnit",
    "User",
    "UserRole",
    "Role",
    "RolePermission",
    "Permission",
    "RefreshToken",
    "ExternalIdentity",
    "Borrower",
    "Category",
    "Location",
    "Asset",
    "AssetHistory",
    "Borrowing",
    "BorrowingItem",
    "Return",
    "ReturnItem",
    "DamageReport",
    "LossReport",
    "NotificationTemplate",
    "NotificationEvent",
    "Notification",
    "NotificationLog",
    "EmailDelivery",
    "AuditLog",
    "SystemSetting",
]
