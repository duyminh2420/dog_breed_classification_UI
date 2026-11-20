import type {
  EpochMetric,
  NotebookModelSpec,
  PreprocessingSpec,
} from '../types/dognet.ts';

export const SWIN_T_EPOCHS: EpochMetric[] = [
  { epoch: 0, trainLoss: 2.7139, trainAcc: 0.5938, testLoss: 1.1774, testAcc: 0.8957 },
  { epoch: 1, trainLoss: 1.1634, trainAcc: 0.8134, testLoss: 0.4672, testAcc: 0.9286 },
  { epoch: 2, trainLoss: 0.786, trainAcc: 0.8401, testLoss: 0.2946, testAcc: 0.9429 },
  { epoch: 3, trainLoss: 0.669, trainAcc: 0.8454, testLoss: 0.2334, testAcc: 0.9543 },
  { epoch: 4, trainLoss: 0.6091, trainAcc: 0.8497, testLoss: 0.198, testAcc: 0.9643 },
  { epoch: 5, trainLoss: 0.5633, trainAcc: 0.8555, testLoss: 0.177, testAcc: 0.9600 },
  { epoch: 6, trainLoss: 0.5381, trainAcc: 0.8561, testLoss: 0.1632, testAcc: 0.9600 },
  { epoch: 7, trainLoss: 0.5191, trainAcc: 0.8635, testLoss: 0.1618, testAcc: 0.9614 },
  { epoch: 8, trainLoss: 0.5108, trainAcc: 0.8631, testLoss: 0.1604, testAcc: 0.9614 },
  { epoch: 9, trainLoss: 0.5144, trainAcc: 0.8622, testLoss: 0.1591, testAcc: 0.9614 },
];

export const NOTEBOOK_MODELS: NotebookModelSpec[] = [
  {
    id: 'swin_t',
    name: 'Swin-T (Swin Transformer Tiny)',
    torchvisionWeights: 'IMAGENET1K_V1',
    headArchitecture: 'Linear(in_features=768, out_features=71)',
    trainingScope: 'Frozen backbone · Classifier head fine-tuned',
    optimizer: 'SGD (lr=0.001, momentum=0.9)',
    scheduler: 'StepLR (step_size=7, gamma=0.1)',
    batchSize: 16,
    epochsConfigured: 10,
    bestValAccuracy: 96.43,
    finalValAccuracy: 96.14,
    finalTestLoss: 0.1591,
    trainingDuration: '12m 36s',
    notebookStatus: 'Completed 10/10 epochs · Peak val accuracy 0.964286 at Epoch 4',
    summary:
      'Primary benchmark model in final_DogNet__1__3ebfd580.ipynb. Reached 89.57% validation accuracy on Epoch 0 and peaked at 96.43% on Epoch 4 with CrossEntropyLoss.',
  },
  {
    id: 'resnet18',
    name: 'ResNet-18',
    torchvisionWeights: 'IMAGENET1K_V1',
    headArchitecture: 'Linear(in_features=512, out_features=71)',
    trainingScope: 'Frozen backbone · Final fc layer fine-tuned',
    optimizer: 'SGD (lr=0.001, momentum=0.9)',
    scheduler: 'StepLR (step_size=7, gamma=0.1)',
    batchSize: 16,
    epochsConfigured: 10,
    bestValAccuracy: null,
    finalValAccuracy: null,
    finalTestLoss: null,
    trainingDuration: null,
    notebookStatus: 'Model initialized and pretrained weights downloaded; training loop not logged in notebook outputs',
    summary:
      'Configured with frozen residual stages and a 512-to-71 fully connected output head as a convolutional baseline alongside Swin-T.',
  },
  {
    id: 'alexnet',
    name: 'Modified AlexNet',
    torchvisionWeights: 'IMAGENET1K_V1',
    headArchitecture: 'features[10]=Conv2d(256,256,3) · Linear(4096,2048) · Linear(2048,71)',
    trainingScope: 'All model parameters updated (unfrozen)',
    optimizer: 'SGD (lr=0.001, momentum=0.9)',
    scheduler: 'StepLR (step_size=7, gamma=0.1)',
    batchSize: 16,
    epochsConfigured: 10,
    bestValAccuracy: null,
    finalValAccuracy: null,
    finalTestLoss: null,
    trainingDuration: null,
    notebookStatus: 'Started at Epoch 0/9; full training output omitted from saved notebook',
    summary:
      'Customized convolutional baseline reducing penultimate classifier width from 4096 to 2048 for 71 dog breed classes.',
  },
];

export const PREPROCESSING_SPEC: PreprocessingSpec = {
  trainTransforms: [
    'RandomResizedCrop(224)',
    'RandomHorizontalFlip()',
    'ToTensor()',
    'Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])',
  ],
  testTransforms: [
    'Resize(256)',
    'CenterCrop(224)',
    'ToTensor()',
    'Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])',
  ],
  inputSize: 224,
  resizeSize: 256,
  normalizationMean: [0.485, 0.456, 0.406],
  normalizationStd: [0.229, 0.224, 0.225],
  batchSize: 16,
  numClasses: 71,
};
