FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY dognet_model/requirements.txt ./dognet_model/requirements.txt
RUN python -m pip install --no-cache-dir \
        torch==2.2.2 torchvision==0.17.2 \
        --index-url https://download.pytorch.org/whl/cu121 \
    && python -m pip install --no-cache-dir -r dognet_model/requirements.txt

COPY dognet_model/__init__.py dognet_model/serve.py ./dognet_model/
COPY dognet_model/artifacts/best_model.pth ./dognet_model/artifacts/best_model.pth

EXPOSE 8001

CMD ["sh", "-c", "uvicorn dognet_model.serve:app --host 0.0.0.0 --port ${PORT:-8001}"]
