import base64
import binascii
import io
import time
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError
from torchvision import models, transforms


CHECKPOINT_PATH = Path(__file__).parent / "artifacts" / "best_model.pth"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None
CHECKPOINT = None
PREPROCESS = transforms.Compose(
    [
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)

app = FastAPI(title="DogNet local model service")


class ClassificationRequest(BaseModel):
    imageBase64: str
    mimeType: Optional[str] = None
    cropMode: Optional[str] = "full-frame"


@app.on_event("startup")
def load_checkpoint():
    global MODEL, CHECKPOINT
    if not CHECKPOINT_PATH.is_file():
        return

    checkpoint = torch.load(
        CHECKPOINT_PATH,
        map_location=DEVICE,
        weights_only=True,
    )
    class_names = checkpoint.get("class_names")
    if not isinstance(class_names, list) or not class_names:
        raise RuntimeError("Checkpoint is missing its class_names list.")
    if checkpoint.get("architecture") != "swin_t":
        raise RuntimeError("Unsupported checkpoint architecture; expected swin_t.")

    model = models.swin_t(weights=None)
    model.head = nn.Linear(model.head.in_features, len(class_names))
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(DEVICE)
    model.eval()
    MODEL = model
    CHECKPOINT = checkpoint


@app.get("/health")
def health(response: Response):
    response.status_code = 200 if MODEL is not None else 503
    return {
        "ok": MODEL is not None,
        "modelLoaded": MODEL is not None,
        "checkpoint": str(CHECKPOINT_PATH),
        "device": str(DEVICE),
    }


@app.post("/classify")
def classify(request: ClassificationRequest):
    if MODEL is None or CHECKPOINT is None:
        raise HTTPException(
            status_code=503,
            detail="No trained checkpoint found. Train the model with dognet_model/train.py first.",
        )

    raw_payload = request.imageBase64.strip()
    mime_type = (request.mimeType or "image/jpeg").lower()
    if raw_payload.startswith("data:"):
        header, separator, raw_payload = raw_payload.partition(",")
        if not separator or ";base64" not in header.lower():
            raise HTTPException(status_code=400, detail="Image data URI must be base64 encoded.")
        mime_type = header[5:].split(";", 1)[0].lower()
    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are supported.")

    try:
        image_bytes = base64.b64decode(raw_payload, validate=True)
    except (binascii.Error, ValueError) as error:
        raise HTTPException(status_code=400, detail="Image payload is not valid base64.") from error
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="Could not decode the uploaded image.") from error

    started_at = time.perf_counter()
    tensor = PREPROCESS(image).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        probabilities = torch.softmax(MODEL(tensor), dim=1)[0]
    top_count = min(5, len(CHECKPOINT["class_names"]))
    scores, indices = torch.topk(probabilities, top_count)
    predictions = [
        {
            "breed": CHECKPOINT["class_names"][index],
            "confidencePercent": round(score.item() * 100, 1),
            "visualCues": "Score from the local breed classifier.",
        }
        for score, index in zip(scores.cpu(), indices.cpu())
    ]
    best_accuracy = float(CHECKPOINT["best_val_accuracy"]) * 100
    final_accuracy = float(CHECKPOINT["final_val_accuracy"]) * 100
    test_accuracy = CHECKPOINT.get("test_accuracy")

    return {
        "isDog": True,
        "subjectSummary": "Dog-breed classifier result; this model assumes the image contains a dog.",
        "primaryBreed": predictions[0]["breed"],
        "primaryConfidence": predictions[0]["confidencePercent"],
        "breedGroup": "Canine",
        "reasoning": "Predictions are produced by the locally trained Swin-T classifier.",
        "topPredictions": predictions,
        "inferenceMs": round((time.perf_counter() - started_at) * 1000),
        "modelUsed": "DogNet Swin-T (local checkpoint)",
        "cropMode": request.cropMode if request.cropMode == "center-224" else "full-frame",
        "benchmarkReference": {
            "architecture": "Swin-T (swin_t)",
            "bestValAccuracy": round(best_accuracy, 2),
            "finalValAccuracy": round(final_accuracy, 2),
            "testAccuracy": (
                round(float(test_accuracy) * 100, 2)
                if test_accuracy is not None
                else None
            ),
            "classesCount": len(CHECKPOINT["class_names"]),
        },
    }
