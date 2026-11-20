import argparse
import copy
import random
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.optim import SGD
from torch.optim.lr_scheduler import StepLR
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, models, transforms


IMAGE_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
DEFAULT_DATA_DIR = Path(__file__).parent.parent / "lib"
IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".ppm",
    ".bmp",
    ".pgm",
    ".tif",
    ".tiff",
    ".webp",
}


def has_image_files(directory):
    return any(
        path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        for path in directory.rglob("*")
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Train DogNet Swin-T on an ImageFolder dataset.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "artifacts" / "best_model.pth")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--validation-fraction", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-pretrained", action="store_true", help="Train from random initialization.")
    return parser.parse_args()


def make_stratified_split(dataset, validation_fraction, seed):
    indices_by_class = [[] for _ in dataset.classes]
    for index, (_, class_index) in enumerate(dataset.samples):
        indices_by_class[class_index].append(index)

    generator = random.Random(seed)
    train_indices = []
    validation_indices = []
    for indices in indices_by_class:
        if len(indices) < 2:
            raise SystemExit(
                "Each breed needs at least two training images to create a validation split."
            )
        generator.shuffle(indices)
        validation_count = max(1, round(len(indices) * validation_fraction))
        validation_count = min(validation_count, len(indices) - 1)
        validation_indices.extend(indices[:validation_count])
        train_indices.extend(indices[validation_count:])
    return train_indices, validation_indices


def evaluate(model, loader, dataset_size, device, criterion):
    model.eval()
    total_loss = 0.0
    correct = 0
    with torch.inference_mode():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)
            logits = model(images)
            total_loss += criterion(logits, labels).item() * images.size(0)
            correct += (logits.argmax(dim=1) == labels).sum().item()
    return total_loss / dataset_size, correct / dataset_size


def main():
    args = parse_args()
    train_dir = args.data_dir / "train"
    val_dir = args.data_dir / "valid"
    if not val_dir.is_dir():
        val_dir = args.data_dir / "val"
    test_dir = args.data_dir / "test"
    if not train_dir.is_dir():
        raise SystemExit(
            "Training data folder is missing. Expected train/<breed>/ under "
            "{}.".format(args.data_dir)
        )
    if (
        args.epochs < 1
        or args.batch_size < 1
        or args.workers < 0
        or not 0 < args.validation_fraction < 1
    ):
        raise SystemExit(
            "--epochs and --batch-size must be positive, --workers cannot be negative, "
            "and --validation-fraction must be between 0 and 1."
        )

    transforms_by_phase = {
        "train": transforms.Compose(
            [
                transforms.RandomResizedCrop(IMAGE_SIZE),
                transforms.RandomHorizontalFlip(),
                transforms.ToTensor(),
                transforms.Normalize(MEAN, STD),
            ]
        ),
        "val": transforms.Compose(
            [
                transforms.Resize(256),
                transforms.CenterCrop(IMAGE_SIZE),
                transforms.ToTensor(),
                transforms.Normalize(MEAN, STD),
            ]
        ),
    }
    train_dataset = datasets.ImageFolder(train_dir, transforms_by_phase["train"])
    validation_source = None
    if val_dir.is_dir() and has_image_files(val_dir):
        validation_source = datasets.ImageFolder(val_dir, transforms_by_phase["val"])
    elif val_dir.is_dir():
        print(
            "Validation folder contains no images; creating a stratified "
            "validation split from training data."
        )
    class_names = train_dataset.classes
    if len(class_names) < 2:
        raise SystemExit("Training data must contain at least two breed folders.")
    train_sample_counts = [0] * len(class_names)
    for _, class_index in train_dataset.samples:
        train_sample_counts[class_index] += 1
    if any(count == 0 for count in train_sample_counts):
        raise SystemExit("Every training breed folder must contain at least one image.")

    if validation_source is not None:
        if validation_source.classes != class_names:
            raise SystemExit(
                "Train and validation folders must contain the same breed subfolders."
            )
        training_data = train_dataset
        validation_data = validation_source
        print("Using validation images from {}".format(val_dir))
    else:
        evaluation_train_dataset = datasets.ImageFolder(
            train_dir, transforms_by_phase["val"]
        )
        train_indices, validation_indices = make_stratified_split(
            train_dataset, args.validation_fraction, args.seed
        )
        training_data = Subset(train_dataset, train_indices)
        validation_data = Subset(evaluation_train_dataset, validation_indices)
        print(
            "Using a stratified {:.0%} training holdout for validation (seed {}).".format(
                args.validation_fraction, args.seed
            )
        )

    image_datasets = {"train": training_data, "val": validation_data}
    test_dataset = None
    if test_dir.is_dir() and has_image_files(test_dir):
        candidate_test_dataset = datasets.ImageFolder(
            test_dir, transforms_by_phase["val"]
        )
        if candidate_test_dataset.classes != class_names:
            raise SystemExit(
                "Train and test folders must contain the same breed subfolders."
            )
        test_dataset = candidate_test_dataset

    loaders = {
        "train": DataLoader(
            training_data,
            batch_size=args.batch_size,
            shuffle=True,
            num_workers=args.workers,
            pin_memory=torch.cuda.is_available(),
        ),
        "val": DataLoader(
            validation_data,
            batch_size=args.batch_size,
            shuffle=False,
            num_workers=args.workers,
            pin_memory=torch.cuda.is_available(),
        ),
    }
    test_loader = (
        DataLoader(
            test_dataset,
            batch_size=args.batch_size,
            shuffle=False,
            num_workers=args.workers,
            pin_memory=torch.cuda.is_available(),
        )
        if test_dataset is not None
        else None
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weights = None if args.no_pretrained else models.Swin_T_Weights.DEFAULT
    model = models.swin_t(weights=weights)
    model.head = nn.Linear(model.head.in_features, len(class_names))

    if args.no_pretrained:
        trainable_parameters = model.parameters()
    else:
        for parameter in model.parameters():
            parameter.requires_grad = False
        for parameter in model.head.parameters():
            parameter.requires_grad = True
        trainable_parameters = model.head.parameters()

    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = SGD(trainable_parameters, lr=0.001, momentum=0.9)
    scheduler = StepLR(optimizer, step_size=7, gamma=0.1)
    best_accuracy = -1.0
    best_state = copy.deepcopy(model.state_dict())
    final_accuracy = 0.0
    test_accuracy = None
    args.output.parent.mkdir(parents=True, exist_ok=True)
    started_at = time.time()

    print("Device: {}".format(device))
    print("Classes: {}".format(len(class_names)))
    print("Training images: {}".format(len(training_data)))
    print("Validation images: {}".format(len(validation_data)))
    if test_dataset is not None:
        print("Held-out test images: {}".format(len(test_dataset)))

    for epoch in range(args.epochs):
        print("Epoch {}/{}".format(epoch + 1, args.epochs))
        for phase in ("train", "val"):
            is_training = phase == "train"
            model.train(is_training)
            if is_training:
                total_loss = 0.0
                correct = 0
                for images, labels in loaders[phase]:
                    images = images.to(device)
                    labels = labels.to(device)
                    optimizer.zero_grad()

                    with torch.set_grad_enabled(True):
                        logits = model(images)
                        loss = criterion(logits, labels)
                        loss.backward()
                        optimizer.step()

                    total_loss += loss.item() * images.size(0)
                    correct += (logits.argmax(dim=1) == labels).sum().item()
                scheduler.step()
                epoch_loss = total_loss / len(training_data)
                epoch_accuracy = correct / len(training_data)
            else:
                epoch_loss, epoch_accuracy = evaluate(
                    model, loaders[phase], len(validation_data), device, criterion
                )

            print(
                "  {} loss: {:.4f} accuracy: {:.2%}".format(
                    phase, epoch_loss, epoch_accuracy
                )
            )
            if not is_training:
                final_accuracy = epoch_accuracy
                if epoch_accuracy > best_accuracy:
                    best_accuracy = epoch_accuracy
                    best_state = copy.deepcopy(model.state_dict())

    model.load_state_dict(best_state)
    if test_loader is not None:
        test_loss, test_accuracy = evaluate(
            model, test_loader, len(test_dataset), device, criterion
        )
        print("Held-out test loss: {:.4f}".format(test_loss))
        print("Held-out test accuracy: {:.2%}".format(test_accuracy))

    elapsed_seconds = time.time() - started_at
    torch.save(
        {
            "architecture": "swin_t",
            "model_state_dict": best_state,
            "class_names": class_names,
            "input_size": IMAGE_SIZE,
            "normalization_mean": MEAN,
            "normalization_std": STD,
            "best_val_accuracy": best_accuracy,
            "final_val_accuracy": final_accuracy,
            "test_accuracy": test_accuracy,
            "epochs_trained": args.epochs,
        },
        args.output,
    )
    print("Best validation accuracy: {:.2%}".format(best_accuracy))
    print("Final validation accuracy: {:.2%}".format(final_accuracy))
    print("Elapsed: {:.1f} minutes".format(elapsed_seconds / 60))
    print("Saved checkpoint: {}".format(args.output.resolve()))


if __name__ == "__main__":
    main()
