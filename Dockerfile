# Use a small Python image
FROM python:3.12-slim

# Avoid prompts & enable faster logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps (build + runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Workdir
WORKDIR /app

# Only install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

# Copy source
COPY . .

# Expose the app port used by Uvicorn/Gunicorn (Azure will route to it)
ENV PORT=8000

# (Optional) set a small cache TTL for prod; override in Container App if needed
ENV CACHE_SECONDS=600

# Start the FastAPI app with multiple workers (good defaults for ACA)
# Adjust workers based on CPU if needed (here: 2)
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "-b", "0.0.0.0:8000", "-w", "2", "--timeout", "120"]
