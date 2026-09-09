FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2-binary wheel + healthcheck curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the whole repo (backend needs ../ml and ../data at runtime for the
# forecaster + seed script - see app/core/config.py ML_MODEL_PATH/DATA_PATH)
COPY backend ./backend
COPY ml ./ml
COPY data ./data

# The repo ships a pre-trained model artifact (ml/models/freight_model.joblib,
# deterministic seed=42) so `docker compose up` works with zero extra steps.
# To retrain inside the image instead (e.g. after editing ml/training/train.py),
# uncomment the next line:
# RUN python ml/training/train.py

WORKDIR /app/backend

ENV PYTHONPATH=/app/backend
ENV DATA_PATH=/app/data/synthetic
ENV ML_MODEL_PATH=/app/ml/models/freight_model.joblib

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
