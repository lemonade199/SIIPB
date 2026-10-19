"""Compatibility: NotificationLog has been consolidated into NotificationDelivery."""
from app.models.notification_delivery import NotificationDelivery

NotificationLog = NotificationDelivery
__all__ = ["NotificationDelivery", "NotificationLog"]
