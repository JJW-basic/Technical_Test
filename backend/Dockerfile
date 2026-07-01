FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

# Copy pyproject.toml and sync dependencies using uv
COPY pyproject.toml /app/
RUN uv pip install --system -r pyproject.toml

# Copy project files
COPY . /app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
