# ── Stage 1: dependency builder ───────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build deps for native extensions (argon2, cryptography, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Non-root user
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup --no-create-home appuser

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy source
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
