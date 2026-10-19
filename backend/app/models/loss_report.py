"""Compatibility re-export: LossReport consolidated into AssetIncidentReport."""
from app.models.asset_incident_report import AssetIncidentReport, LossReport

__all__ = ["AssetIncidentReport", "LossReport"]
