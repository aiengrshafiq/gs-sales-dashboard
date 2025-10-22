# --- Stage 1: The "Builder" ---
# Use the full Python image which includes build tools
FROM python:3.12-bookworm as builder

# Set ENV vars
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set up a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy *only* requirements and install them
# This is the slow, compiling step. It will be cached.
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# --- Stage 2: The "Final Image" ---
# Start from the small slim image
FROM python:3.12-slim-bookworm

# Set ENV vars
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy the virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy your application code (respecting .dockerignore)
COPY . .

# Activate the venv for the final command
ENV PATH="/opt/venv/bin:$PATH"

# Set the port
ENV PORT=8000
ENV CACHE_SECONDS=600

#
# --- CRITICAL CMD FIX ---
#
# You are using Dash (built on Flask), which is a WSGI application.
# Your old CMD used "uvicorn.workers.UvicornWorker", which is for ASGI (FastAPI).
# This new CMD correctly uses Gunicorn's default sync worker for Dash.
# It points to "dashboard:server" (the 'server' object in your 'dashboard.py' file).
#
CMD ["gunicorn", "dashboard:server", "-b", "0.0.0.0:8000", "-w", "2", "--timeout", "120"]

# # Use a small Python image
# FROM python:3.12-slim

# # Avoid prompts & enable faster logs
# ENV PYTHONDONTWRITEBYTECODE=1 \
#     PYTHONUNBUFFERED=1

# # System deps (build + runtime)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

# # Workdir
# WORKDIR /app

# # Only install dependencies first (better layer caching)
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt \
#     && pip install --no-cache-dir gunicorn

# # Copy source
# COPY . .

# # Expose the app port used by Uvicorn/Gunicorn (Azure will route to it)
# ENV PORT=8000

# # (Optional) set a small cache TTL for prod; override in Container App if needed
# ENV CACHE_SECONDS=600

# # Start the FastAPI app with multiple workers (good defaults for ACA)
# # Adjust workers based on CPU if needed (here: 2)
# CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "-b", "0.0.0.0:8000", "-w", "2", "--timeout", "120"]
