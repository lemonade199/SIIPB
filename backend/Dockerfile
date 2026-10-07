# ========================================================
# SIIPB Backend — Python 3.12 + Gunicorn
# (WeasyPrint: Pango; backup: mariadb-client)
# ========================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl libmariadb-dev mariadb-client \
        libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libharfbuzz-subset0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && mkdir -p /app/uploads/assets /app/uploads/evidence /app/backups \
    && useradd --create-home --uid 10001 siipb \
    && chown -R siipb:siipb /app/uploads /app/backups
USER siipb

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--threads", "2", "--timeout", "120", \
     "--access-logfile", "-", "--error-logfile", "-", "run:app"]
