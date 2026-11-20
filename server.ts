import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  NOTEBOOK_MODELS,
  PREPROCESSING_SPEC,
  SWIN_T_EPOCHS,
} from "./src/data/dognetBenchmarks.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_SERVICE_URL = (
  process.env.DOGNET_MODEL_URL || "http://127.0.0.1:8001"
).replace(/\/$/, "");
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  app.get("/api/health", async (_req, res) => {
    try {
      const response = await fetch(`${MODEL_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const health = await response.json();
      res.status(response.ok ? 200 : 503).json({
        ok: response.ok,
        modelService: health,
      });
    } catch (err: unknown) {
      res.status(503).json({
        ok: false,
        error: "The local DogNet model service is unavailable.",
        details: err instanceof Error ? err.message : "Unknown connection error.",
      });
    }
  });

  app.get("/api/model-info", (_req, res) => {
    res.json({
      notebookFilename: "final_DogNet__1__3ebfd580.ipynb",
      inferenceEngine: "Local DogNet Swin-T (PyTorch)",
      weightsAttachedInRepo: false,
      preprocessing: PREPROCESSING_SPEC,
      models: NOTEBOOK_MODELS,
      swinTEpochs: SWIN_T_EPOCHS,
    });
  });

  app.post("/api/classify", async (req, res) => {
    const body = req.body as {
      imageBase64?: unknown;
      mimeType?: unknown;
      cropMode?: unknown;
    };

    if (
      !body ||
      typeof body.imageBase64 !== "string" ||
      body.imageBase64.trim().length < 32
    ) {
      res.status(400).json({
        error: "A valid image payload (base64) is required for classification.",
      });
      return;
    }

    const dataUriMime = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i.exec(
      body.imageBase64.trim()
    )?.[1];
    const mimeType =
      typeof body.mimeType === "string" && body.mimeType.trim()
        ? body.mimeType.trim().toLowerCase()
        : (dataUriMime || "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      res.status(400).json({
        error: `Unsupported image format (${mimeType}). Please upload a JPEG, PNG, or WebP image.`,
      });
      return;
    }

    try {
      const response = await fetch(`${MODEL_SERVICE_URL}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: body.imageBase64,
          mimeType,
          cropMode:
            body.cropMode === "center-224" ? "center-224" : "full-frame",
        }),
        signal: AbortSignal.timeout(60000),
      });
      const responseBody = await response.text();
      res.setHeader(
        "Content-Type",
        response.headers.get("content-type") || "application/json"
      );
      res.status(response.status).send(responseBody);
    } catch (err: unknown) {
      res.status(503).json({
        error:
          "The local DogNet model service is unavailable. Start it using the instructions in dognet_model/README.md.",
        details: err instanceof Error ? err.message : "Unknown connection error.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DogNet server running at http://0.0.0.0:${PORT}`);
    console.log(`Local model service: ${MODEL_SERVICE_URL}`);
  });
}

startServer().catch((err: unknown) => {
  console.error("Failed to start DogNet server:", err);
  process.exit(1);
});
