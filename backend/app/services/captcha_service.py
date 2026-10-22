"""CAPTCHA gambar 6 karakter untuk login lokal. Jawaban disimpan sebagai HMAC di Redis
(atau di memori bila Redis tidak tersedia) dan hanya bisa dipakai sekali."""
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

# tanpa karakter yang mudah tertukar: 0, O, 1, I, 5, S, Z
CAPTCHA_CHARSET = "2346789ABCDEFGHJKLMNPQRTUVWXY"
CAPTCHA_LENGTH = 6
CAPTCHA_TTL_SECONDS = 300
MAX_VERIFICATION_ATTEMPTS = 3
IMAGE_WIDTH = 180
IMAGE_HEIGHT = 50


def _hash_answer(answer: str) -> str:
    normalized = answer.strip().upper().encode("utf-8")
    secret = (Config.SECRET_KEY or "siipb-default-secret").encode("utf-8")
    return hmac.new(secret, normalized, hashlib.sha256).hexdigest()


class InMemoryCaptchaStore:
    """Cadangan untuk pengembangan lokal dan tes bila Redis tidak tersedia (hanya untuk satu proses)."""

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
                self._challenges.pop(challenge_id, None)
                return True, "OK"

            record["attempts"] += 1
            if record["attempts"] >= MAX_VERIFICATION_ATTEMPTS:
                self._challenges.pop(challenge_id, None)
                return False, "Kode CAPTCHA salah (batas percobaan tercapai)."

            return False, "Kode CAPTCHA salah."


class RedisCaptchaStore:
    """Dipakai di production agar challenge bisa diverifikasi oleh worker Gunicorn mana pun."""

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
            self._client.delete(key)
            return True, "OK"

        attempts = record.get("attempts", 0) + 1
        if attempts >= MAX_VERIFICATION_ATTEMPTS:
            self._client.delete(key)
            return False, "Kode CAPTCHA salah (batas percobaan tercapai)."

        # simpan jumlah percobaan tanpa memperpanjang masa berlaku
        ttl = self._client.ttl(key)
        if ttl and ttl > 0:
            record["attempts"] = attempts
            self._client.set(key, json.dumps(record), ex=ttl)
        else:
            self._client.delete(key)

        return False, "Kode CAPTCHA salah."


class CaptchaService:
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
        return "".join(secrets.choice(CAPTCHA_CHARSET) for _ in range(length))

    def render_image(self, code: str) -> str:
        """Gambar PNG (data URI) berisi kode dengan titik acak, garis pengganggu, dan huruf yang dimiringkan."""
        bg_r = secrets.randbelow(15) + 240
        bg_g = secrets.randbelow(15) + 240
        bg_b = secrets.randbelow(15) + 244
        image = Image.new("RGBA", (IMAGE_WIDTH, IMAGE_HEIGHT), color=(bg_r, bg_g, bg_b, 255))
        draw = ImageDraw.Draw(image)

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

        try:
            font = ImageFont.load_default(size=26)
        except TypeError:
            font = ImageFont.load_default()

        char_box_w = IMAGE_WIDTH // (len(code) + 1)
        start_offset_x = (IMAGE_WIDTH - (len(code) * char_box_w)) // 2

        for i, char in enumerate(code):
            text_color = (
                secrets.randbelow(40) + 20,
                secrets.randbelow(50) + 30,
                secrets.randbelow(60) + 80,
                255,
            )
            char_img = Image.new("RGBA", (36, 40), color=(0, 0, 0, 0))
            char_draw = ImageDraw.Draw(char_img)
            char_draw.text((6, 2), char, fill=text_color, font=font)

            angle = random.uniform(-16, 16)
            rotated_char = char_img.rotate(angle, expand=True, resample=Image.Resampling.BILINEAR)

            dest_x = start_offset_x + (i * char_box_w) + secrets.randbelow(4) - 2
            dest_y = (IMAGE_HEIGHT - rotated_char.height) // 2 + secrets.randbelow(6) - 3
            image.paste(rotated_char, (int(dest_x), int(dest_y)), rotated_char)

        buf = io.BytesIO()
        rgb_image = image.convert("RGB")
        rgb_image.save(buf, format="PNG", optimize=True)
        raw_bytes = buf.getvalue()
        b64 = base64.b64encode(raw_bytes).decode("ascii")
        return f"data:image/png;base64,{b64}"

    def create_challenge(self) -> dict[str, Any]:
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
        if not challenge_id or not answer:
            return False, "Kode CAPTCHA dan ID challenge wajib disertakan."

        store = self._get_store()
        return store.verify_and_consume(challenge_id.strip(), answer.strip())


captcha_service = CaptchaService()
