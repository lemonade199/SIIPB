"""Compatibility re-export: DamageReport consolidated into AssetIncidentReport."""
from app.models.asset_incident_report import AssetIncidentReport, DamageReport

__all__ = ["AssetIncidentReport", "DamageReport"]
