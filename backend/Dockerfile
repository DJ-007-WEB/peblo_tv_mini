FROM python:3.12-slim

WORKDIR /app
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .
COPY backend/app ./app
COPY seed_shows.json reference.json ./
COPY assets ./assets
RUN mkdir -p /app/storage

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
