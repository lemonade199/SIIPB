"""Compatibility re-export: EmailDelivery consolidated into NotificationDelivery."""
from app.models.notification_delivery import EmailDelivery, NotificationDelivery

__all__ = ["EmailDelivery", "NotificationDelivery"]
