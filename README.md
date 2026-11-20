# DogNet Classifier

DogNet uses a local PyTorch Swin-T classifier for breed predictions; no Gemini
API key is required. You need Node.js and Python 3.9 or newer.

<img width="1542" height="1222" alt="image" src="https://github.com/user-attachments/assets/17ed1481-1232-4fd6-8f64-40f8f47588e8" />
<img width="1385" height="1226" alt="image" src="https://github.com/user-attachments/assets/a2246adc-8b0d-4339-a41a-7e99ad4bd978" />
<img width="1380" height="725" alt="image" src="https://github.com/user-attachments/assets/ff3bb83c-9005-4104-9b75-438e6c1f3f8c" />


## Train the model (Windows PowerShell)

Run commands from the project root. The dataset is in `lib/train`, `lib/valid`,
and `lib/test`, with one folder per breed. If `lib/valid` has no images, the
trainer creates a deterministic, stratified 10% validation split from
`lib/train`; `lib/test` remains held out for final evaluation.

### One-time Python setup

Skip this section if `dognet_model\.venv` is already set up. Do not recreate or
clear the virtual environment while training is running.

```powershell
$pythonBase = py -3.9 -c "import sys; print(sys.base_prefix)"
$env:PATH = "$pythonBase\Library\bin;$pythonBase;$env:PATH"
if (-not (Test-Path dognet_model\.venv\Scripts\python.exe)) {
  py -3.9 -m venv dognet_model\.venv
}
dognet_model\.venv\Scripts\python.exe -m pip install --upgrade pip
dognet_model\.venv\Scripts\python.exe -m pip install torch==2.2.2 torchvision==0.17.2 --index-url https://download.pytorch.org/whl/cu121
dognet_model\.venv\Scripts\python.exe -m pip install -r dognet_model\requirements.txt
```

### Start training

Run in the same terminal after setup. If training is already running, let it
finish; do not start a second training process.

```powershell
$pythonBase = py -3.9 -c "import sys; print(sys.base_prefix)"
$env:PATH = "$pythonBase\Library\bin;$pythonBase;$env:PATH"
dognet_model\.venv\Scripts\python.exe dognet_model\train.py --epochs 10 --batch-size 4
```

Wait for `Saved checkpoint: ...best_model.pth`. Verify the file exists:

```powershell
Test-Path dognet_model\artifacts\best_model.pth
```

It should return `True`. The first run downloads torchvision's pretrained
Swin-T weights. If CUDA runs out of memory, retry with `--batch-size 2`.
More training options are in [dognet_model/README.md](./dognet_model/README.md).

## Run locally

After training, start the Python inference service in one terminal:

```powershell
$pythonBase = py -3.9 -c "import sys; print(sys.base_prefix)"
$env:PATH = "$pythonBase\Library\bin;$pythonBase;$env:PATH"
dognet_model\.venv\Scripts\python.exe -m uvicorn dognet_model.serve:app --host 127.0.0.1 --port 8001
```

In another terminal:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. If no trained checkpoint is present, the app
reports that classification is unavailable instead of using a remote model.

## Cloud deployment: Vercel frontend + model container

Training happens locally. Deploy the trained checkpoint with the Python
inference service on a container host; deploy only the Vite frontend to
Vercel. A GPU-capable container is recommended for responsive Swin-T
inference. The container below uses CUDA 12.1 PyTorch wheels; the host needs
an NVIDIA GPU with a compatible driver to use GPU acceleration.

### Build and test the model container

Run these commands from the project root after training has created
`dognet_model\artifacts\best_model.pth`:

```powershell
docker build -f dognet_model\Dockerfile -t dognet-model:latest .
docker run --rm --gpus all -p 8001:8001 -e PORT=8001 dognet-model:latest
```

In another terminal, confirm the model loaded:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

The response should include `"modelLoaded": true`. If Docker cannot access a
GPU locally, omit `--gpus all` for a CPU smoke test.

### Deploy the model container

Push the image to a container registry supported by your chosen GPU host:

```powershell
docker login
docker tag dognet-model:latest REGISTRY/PROJECT/dognet-model:latest
docker push REGISTRY/PROJECT/dognet-model:latest
```

Replace `REGISTRY/PROJECT` with your registry path. In the hosting provider,
create a service from that image, enable a GPU, expose the container port
`8001` (or set its `PORT` environment variable), and configure `/health` as
the health check. The provider should give the service a public HTTPS URL.
Provider-specific deployment commands differ.

### Deploy the frontend to Vercel

Create `vercel.json` in the project root, replacing `MODEL_HOST` with the
hostname from your model service:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/classify",
      "destination": "https://MODEL_HOST/classify"
    },
    {
      "source": "/api/health",
      "destination": "https://MODEL_HOST/health"
    }
  ]
}
```

These rewrites preserve the frontend's existing `/api/...` URLs and send
requests to the Python service. Vercel serves the static frontend; it does not
run the local Express server or host the model weights.

Deploy from the project root:

```powershell
npm install -g vercel
vercel login
vercel
vercel --prod
```

Choose the Vite build settings if prompted: build command `npm run build`,
output directory `dist`. Do not commit the trained checkpoint to Git. The
Docker image contains the checkpoint, so use a private image registry if the
weights should not be public. The inference URL is public unless you add
authentication/rate limiting at the model host or an API gateway; monitor
GPU uptime and usage costs.
