# Use official Python image
FROM python:3.11-slim

# Avoid Python buffering / pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory inside container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .

# First install whatever you already have in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Ensure FastAPI + Uvicorn are installed even if missing in requirements.txt
RUN pip install --no-cache-dir fastapi uvicorn

# Copy API code and model bundle
COPY serve_model.py ./serve_model.py
COPY artifacts/model_tuned.pkl ./artifacts/model_tuned.pkl

# Expose API port
EXPOSE 8000

# Start FastAPI with uvicorn
CMD ["uvicorn", "serve_model:app", "--host", "0.0.0.0", "--port", "8000"]
