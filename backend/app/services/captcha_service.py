"""CAPTCHA Generation and Verification Service.

Provides 6-character visual challenges with visual noise (lines, jitter, rotation)
and secure one-time-use verification using HMAC-SHA256 and adaptive Redis/In-Memory storage.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import logging
import random
import secrets
import threading
import time
import uuid
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from app.config import Config

logger = logging.getLogger(__name__)

# 28 unambiguous alphanumeric characters (excluding 0, O, 1, I, l, 5, S, Z, 2 if ambiguous)
CAPTCHA_CHARSET = "2346789ABCDEFGHJKLMNPQRTUVWXY"
CAPTCHA_LENGTH = 6
CAPTCHA_TTL_SECONDS = 300  # 5 minutes
MAX_VERIFICATION_ATTEMPTS = 3
IMAGE_WIDTH = 180
IMAGE_HEIGHT = 50


def _hash_answer(answer: str) -> str:
    """Generate secure HMAC-SHA256 digest of normalized (uppercase) answer."""
    normalized = answer.strip().upper().encode("utf-8")
    secret = (Config.SECRET_KEY or "siipb-default-secret").encode("utf-8")
    return hmac.new(secret, normalized, hashlib.sha256).hexdigest()


class InMemoryCaptchaStore:
    """Thread-safe in-memory challenge store with auto-expiry cleanup.

    Used as resilient fallback for single-process local dev and test environments
    when Redis is offline or not installed.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._challenges: dict[str, dict[str, Any]] = {}

    def _cleanup_expired(self, now: float) -> None:
        expired = [cid for cid, v in self._challenges.items() if v["expires_at"] <= now]
        for cid in expired:
            self._challenges.pop(cid, None)

    def set(self, challenge_id: str, answer_hash: str, ttl_seconds: int) -> None:
        now = time.time()
        with self._lock:
            self._cleanup_expired(now)
            self._challenges[challenge_id] = {
                "hash": answer_hash,
                "expires_at": now + ttl_seconds,
                "attempts": 0,
            }

    def verify_and_consume(self, challenge_id: str, user_answer: str) -> tuple[bool, str]:
        now = time.time()
        with self._lock:
            self._cleanup_expired(now)
            record = self._challenges.get(challenge_id)
            if not record:
                return False, "Kode CAPTCHA tidak ditemukan atau telah digunakan."
            if record["expires_at"] <= now:
                self._challenges.pop(challenge_id, None)
                return False, "Kode CAPTCHA telah kedaluwarsa."

            user_hash = _hash_answer(user_answer)
            matches = hmac.compare_digest(record["hash"], user_hash)

            if matches:
                # One-time use: consume immediately on success
                self._challenges.pop(challenge_id, None)
                return True, "OK"

            # Wrong answer: increment attempt counter
            record["attempts"] += 1
            if record["attempts"] >= MAX_VERIFICATION_ATTEMPTS:
                # Invalidate challenge after too many failed tries
                self._challenges.pop(challenge_id, None)
                return False, "Kode CAPTCHA salah (batas percobaan tercapai)."

            return False, "Kode CAPTCHA salah."


class RedisCaptchaStore:
    """Redis-backed challenge store for multi-worker production deployments."""

    def __init__(self, redis_url: str) -> None:
        import redis

        self._client = redis.from_url(redis_url, decode_responses=True, socket_timeout=2.0)

    def ping(self) -> bool:
        try:
            return bool(self._client.ping())
        except Exception:
            return False

    def set(self, challenge_id: str, answer_hash: str, ttl_seconds: int) -> None:
        key = f"siipb:captcha:{challenge_id}"
        val = json.dumps({"hash": answer_hash, "attempts": 0})
        self._client.set(key, val, ex=ttl_seconds)

    def verify_and_consume(self, challenge_id: str, user_answer: str) -> tuple[bool, str]:
        key = f"siipb:captcha:{challenge_id}"
        raw = self._client.get(key)
        if not raw:
            return False, "Kode CAPTCHA tidak ditemukan atau telah digunakan."

        try:
            record = json.loads(raw)
        except Exception:
            self._client.delete(key)
            return False, "Data CAPTCHA korup."

        user_hash = _hash_answer(user_answer)
        matches = hmac.compare_digest(record["hash"], user_hash)

        if matches:
            # Single-use: delete immediately
            self._client.delete(key)
            return True, "OK"

        attempts = record.get("attempts", 0) + 1
        if attempts >= MAX_VERIFICATION_ATTEMPTS:
            self._client.delete(key)
            return False, "Kode CAPTCHA salah (batas percobaan tercapai)."

        # Update remaining attempts with remaining TTL
        ttl = self._client.ttl(key)
        if ttl and ttl > 0:
            record["attempts"] = attempts
            self._client.set(key, json.dumps(record), ex=ttl)
        else:
            self._client.delete(key)

        return False, "Kode CAPTCHA salah."


class CaptchaService:
    """High-level CAPTCHA generation and verification manager."""

    def __init__(self) -> None:
        self._in_memory_store = InMemoryCaptchaStore()
        self._redis_store: RedisCaptchaStore | None = None
        self._redis_tested = False

    def _get_store(self) -> InMemoryCaptchaStore | RedisCaptchaStore:
        if not self._redis_tested:
            self._redis_tested = True
            redis_url = getattr(Config, "REDIS_URL", None)
            if redis_url:
                try:
                    store = RedisCaptchaStore(redis_url)
                    if store.ping():
                        self._redis_store = store
                        logger.info("CaptchaService: terhubung ke Redis (%s).", redis_url)
                except Exception as exc:
                    logger.warning("CaptchaService: Redis tidak dapat diakses (%s). Fallback ke in-memory.", exc)

        return self._redis_store if self._redis_store else self._in_memory_store

    def generate_code(self, length: int = CAPTCHA_LENGTH) -> str:
        """Generate cryptographically random alphanumeric string."""
        return "".join(secrets.choice(CAPTCHA_CHARSET) for _ in range(length))

    def render_image(self, code: str) -> str:
        """Render visual CAPTCHA with noise lines, dots, and character jitter.

        Returns:
            str: Data URI string 'data:image/png;base64,...'
        """
        # Light pastel background with slight variation
        bg_r = secrets.randbelow(15) + 240
        bg_g = secrets.randbelow(15) + 240
        bg_b = secrets.randbelow(15) + 244
        image = Image.new("RGBA", (IMAGE_WIDTH, IMAGE_HEIGHT), color=(bg_r, bg_g, bg_b, 255))
        draw = ImageDraw.Draw(image)

        # 1. Background noise dots
        for _ in range(120):
            x = secrets.randbelow(IMAGE_WIDTH)
            y = secrets.randbelow(IMAGE_HEIGHT)
            dot_color = (
                secrets.randbelow(80) + 160,
                secrets.randbelow(80) + 160,
                secrets.randbelow(80) + 160,
                secrets.randbelow(100) + 100,
            )
            draw.point((x, y), fill=dot_color)

        # 2. Draw subtle interference curves
        for _ in range(3):
            line_color = (
                secrets.randbelow(80) + 70,
                secrets.randbelow(80) + 80,
                secrets.randbelow(90) + 120,
                200,
            )
            start_x = 0
            start_y = secrets.randbelow(IMAGE_HEIGHT)
            ctrl1_x = IMAGE_WIDTH // 3
            ctrl1_y = secrets.randbelow(IMAGE_HEIGHT)
            ctrl2_x = (IMAGE_WIDTH * 2) // 3
            ctrl2_y = secrets.randbelow(IMAGE_HEIGHT)
            end_x = IMAGE_WIDTH
            end_y = secrets.randbelow(IMAGE_HEIGHT)

            points = []
            for t in range(50):
                pct = t / 50.0
                px = (
                    (1 - pct) ** 3 * start_x
                    + 3 * (1 - pct) ** 2 * pct * ctrl1_x
                    + 3 * (1 - pct) * pct**2 * ctrl2_x
                    + pct**3 * end_x
                )
                py = (
                    (1 - pct) ** 3 * start_y
                    + 3 * (1 - pct) ** 2 * pct * ctrl1_y
                    + 3 * (1 - pct) * pct**2 * ctrl2_y
                    + pct**3 * end_y
                )
                points.append((px, py))
            draw.line(points, fill=line_color, width=2)

        # 3. Load font
        try:
            font = ImageFont.load_default(size=26)
        except TypeError:
            font = ImageFont.load_default()

        # 4. Render characters with jitter and rotation
        char_box_w = IMAGE_WIDTH // (len(code) + 1)
        start_offset_x = (IMAGE_WIDTH - (len(code) * char_box_w)) // 2

        for i, char in enumerate(code):
            # Text colors: high contrast navy/slate/indigo
            text_color = (
                secrets.randbelow(40) + 20,
                secrets.randbelow(50) + 30,
                secrets.randbelow(60) + 80,
                255,
            )
            # Create sub-image for rotated character
            char_img = Image.new("RGBA", (36, 40), color=(0, 0, 0, 0))
            char_draw = ImageDraw.Draw(char_img)
            char_draw.text((6, 2), char, fill=text_color, font=font)

            angle = random.uniform(-16, 16)
            rotated_char = char_img.rotate(angle, expand=True, resample=Image.Resampling.BILINEAR)

            dest_x = start_offset_x + (i * char_box_w) + secrets.randbelow(4) - 2
            dest_y = (IMAGE_HEIGHT - rotated_char.height) // 2 + secrets.randbelow(6) - 3
            image.paste(rotated_char, (int(dest_x), int(dest_y)), rotated_char)

        # 5. Export to PNG bytes -> Base64 Data URI
        buf = io.BytesIO()
        rgb_image = image.convert("RGB")
        rgb_image.save(buf, format="PNG", optimize=True)
        raw_bytes = buf.getvalue()
        b64 = base64.b64encode(raw_bytes).decode("ascii")
        return f"data:image/png;base64,{b64}"

    def create_challenge(self) -> dict[str, Any]:
        """Generate new challenge ID, render image, and store hashed answer."""
        challenge_id = str(uuid.uuid4())
        code = self.generate_code(CAPTCHA_LENGTH)
        answer_hash = _hash_answer(code)

        store = self._get_store()
        store.set(challenge_id, answer_hash, CAPTCHA_TTL_SECONDS)

        image_uri = self.render_image(code)
        return {
            "captcha_id": challenge_id,
            "image": image_uri,
            "expires_in": CAPTCHA_TTL_SECONDS,
        }

    def verify(self, challenge_id: str | None, answer: str | None) -> tuple[bool, str]:
        """Verify given answer against stored challenge (one-time consumption)."""
        if not challenge_id or not answer:
            return False, "Kode CAPTCHA dan ID challenge wajib disertakan."

        store = self._get_store()
        return store.verify_and_consume(challenge_id.strip(), answer.strip())


# Global singleton service instance
captcha_service = CaptchaService()
