# syntax=docker/dockerfile:1.6

# ---------- Stage 1: build del frontend React/Vite ----------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: runtime Python ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    CARBURANTI_CACHE=/tmp/carburanti \
    CARBURANTI_OPEN_BROWSER=0 \
    PORT=8765

WORKDIR /app

# libgomp serve a pandas/numpy (runtime OpenMP), curl per l'healthcheck
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY backend ./backend
COPY app.py ./
COPY --from=frontend /frontend/dist ./backend/static

# Utente non-root. La cache CSV vive sotto /tmp (ephemera: un tmpfs dal
# runtime la mette in RAM, altrimenti viene distrutta a fine container).
RUN useradd --system --uid 1000 --home-dir /app carburanti \
 && chown -R carburanti:carburanti /app
USER carburanti

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["python", "app.py", "--no-browser"]
