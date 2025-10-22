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

# --- THIS IS THE MISSING LINE ---
# This command tells Gunicorn to run the 'server' object
# from your 'dashboard.py' file.
CMD ["gunicorn", "dashboard:server", "-b", "0.0.0.0:8000", "-w", "2", "--timeout", "120"]