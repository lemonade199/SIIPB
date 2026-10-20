"""Klien SSO OpenID Connect dinamis (Google, Microsoft Entra ID, Keycloak, dll.).

Konfigurasi diambil dari halaman Pengaturan (``settings_service.oidc_config``), bukan hanya dari environment,
sehingga administrator dapat mengganti Identity Provider tanpa restart. Setiap kombinasi
issuer/client ID/secret didaftarkan sebagai klien Authlib tersendiri; state & nonce disimpan di session
dengan nama klien tersebut sehingga callback memakai klien yang sama selama konfigurasi tidak berubah.
"""
from __future__ import annotations

import hashlib
from typing import Any

from app.extensions import oauth


def client_name(cfg: dict[str, Any]) -> str:
    digest = hashlib.sha256(f"{cfg['issuer']}|{cfg['client_id']}|{cfg['client_secret']}".encode("utf-8")).hexdigest()
    return f"oidc_{digest[:16]}"


def get_client(cfg: dict[str, Any]):
    """Klien Authlib untuk konfigurasi OIDC efektif (didaftarkan sekali per konfigurasi)."""
    name = client_name(cfg)
    client = oauth.create_client(name)
    if client is None:
        client = oauth.register(
            name,
            client_id=cfg["client_id"],
            client_secret=cfg["client_secret"],
            server_metadata_url=f"{cfg['issuer']}/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
    return client
