# Local DogNet model

This folder contains a PyTorch Swin-T trainer and a local inference API. The
training setup follows the notebook's ImageNet normalization, 224x224
validation preprocessing, frozen pretrained backbone, and trainable classifier
head. The API loads the best checkpoint written by the trainer.

## Dataset layout

The project dataset is in `lib/`, with one folder per breed:

```text
lib/
  train/
    Beagle/
      image1.jpg
    ...
  valid/
    Beagle/
      image2.jpg
    ...
  test/
    Beagle/
      image3.jpg
```

The training script reads class names from the training folder names. If
`valid/` (or `val/`) contains no images, it makes a deterministic, stratified
10% validation holdout from `train/`. The `test/` split is never used for
training or checkpoint selection; it is evaluated once after training.

## Install and train (Windows PowerShell)

Use Python 3.9 or newer. From the project root:

```powershell
$pythonBase = py -3.9 -c "import sys; print(sys.base_prefix)"
$env:PATH = "$pythonBase\Library\bin;$pythonBase;$env:PATH"
py -3.9 -m venv --clear dognet_model\.venv
dognet_model\.venv\Scripts\python.exe -m pip install --upgrade pip
dognet_model\.venv\Scripts\python.exe -m pip install torch==2.2.2 torchvision==0.17.2 --index-url https://download.pytorch.org/whl/cu121
dognet_model\.venv\Scripts\python.exe -m pip install -r dognet_model\requirements.txt
dognet_model\.venv\Scripts\python.exe dognet_model\train.py --epochs 10 --batch-size 4
```

By default, training downloads torchvision's ImageNet Swin-T weights and
fine-tunes the classifier head, as in the notebook. Use `--no-pretrained` to
train from random initialization; this unfreezes the full model. The first
training run downloads the pretrained weights. Batch size can be lowered if
GPU memory is limited.

The best validation checkpoint is saved to
`dognet_model/artifacts/best_model.pth`. It includes the trained weights, breed
names, measured validation accuracy, and test accuracy. This generated
artifact is ignored by Git.

## Run the app with local inference

In a new terminal, set up the Python DLL path again and start the model API:

```powershell
$pythonBase = py -3.9 -c "import sys; print(sys.base_prefix)"
$env:PATH = "$pythonBase\Library\bin;$pythonBase;$env:PATH"
dognet_model\.venv\Scripts\python.exe -m uvicorn dognet_model.serve:app --host 127.0.0.1 --port 8001
```

In another terminal, install the web dependencies if needed and start the app:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. The Node server proxies classification requests
to the local Python service. If the checkpoint is missing, the model service
reports that explicitly and classification returns an error rather than
falling back to a hosted API.

This model is a breed-only classifier: it does not detect non-dog images and
will still assign a breed to them. Validation/test accuracy is measured on your
dataset splits and does not guarantee performance on new images.
