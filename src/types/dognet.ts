export interface EpochMetric {
  epoch: number;
  trainLoss: number;
  trainAcc: number;
  testLoss: number;
  testAcc: number;
}

export interface NotebookModelSpec {
  id: 'swin_t' | 'resnet18' | 'alexnet';
  name: string;
  torchvisionWeights: string;
  headArchitecture: string;
  trainingScope: string;
  optimizer: string;
  scheduler: string;
  batchSize: number;
  epochsConfigured: number;
  bestValAccuracy: number | null;
  finalValAccuracy: number | null;
  finalTestLoss: number | null;
  trainingDuration: string | null;
  notebookStatus: string;
  summary: string;
}

export interface PreprocessingSpec {
  trainTransforms: string[];
  testTransforms: string[];
  inputSize: number;
  resizeSize: number;
  normalizationMean: [number, number, number];
  normalizationStd: [number, number, number];
  batchSize: number;
  numClasses: number;
}

export interface BreedPredictionItem {
  breed: string;
  confidencePercent: number;
  visualCues: string;
}

export interface ClassificationResult {
  isDog: boolean;
  subjectSummary: string;
  primaryBreed: string;
  primaryConfidence: number;
  breedGroup: string;
  reasoning: string;
  topPredictions: BreedPredictionItem[];
  inferenceMs: number;
  modelUsed: string;
  cropMode: 'center-224' | 'full-frame';
  benchmarkReference: {
    architecture: string;
    bestValAccuracy: number;
    finalValAccuracy: number;
    testAccuracy?: number | null;
    classesCount: number;
  };
}

export interface ClassificationHistoryEntry {
  id: string;
  timestamp: string;
  thumbnailDataUrl: string;
  source: 'upload' | 'camera';
  result: ClassificationResult;
}
