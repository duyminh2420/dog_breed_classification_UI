export interface PreprocessedImageBundle {
  fullFrameDataUrl: string;
  centerCropDataUrl: string;
  originalWidth: number;
  originalHeight: number;
  cropSize: number;
  mimeType: string;
  channelStats: {
    meanR: number;
    meanG: number;
    meanB: number;
    stdR: number;
    stdG: number;
    stdB: number;
  };
}

function drawResizedFullFrame(
  source: HTMLImageElement | HTMLVideoElement,
  srcWidth: number,
  srcHeight: number
): string {
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const targetW = Math.max(1, Math.round(srcWidth * scale));
  const targetH = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable in this browser.');
  }
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Mirrors torchvision.transforms:
 *   transforms.Resize(256),
 *   transforms.CenterCrop(224)
 */
function drawDogNetCenterCrop(
  source: HTMLImageElement | HTMLVideoElement,
  srcWidth: number,
  srcHeight: number
) {
  const resizeShort = 256;
  const cropSize = 224;

  const shortEdge = Math.min(srcWidth, srcHeight);
  const scale = resizeShort / shortEdge;
  const resizedW = Math.max(cropSize, Math.round(srcWidth * scale));
  const resizedH = Math.max(cropSize, Math.round(srcHeight * scale));

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = resizedW;
  tempCanvas.height = resizedH;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    throw new Error('Canvas 2D context is unavailable in this browser.');
  }
  tempCtx.drawImage(source, 0, 0, resizedW, resizedH);

  const offsetX = Math.floor((resizedW - cropSize) / 2);
  const offsetY = Math.floor((resizedH - cropSize) / 2);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropSize;
  cropCanvas.height = cropSize;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    throw new Error('Canvas 2D context is unavailable in this browser.');
  }
  cropCtx.drawImage(
    tempCanvas,
    offsetX,
    offsetY,
    cropSize,
    cropSize,
    0,
    0,
    cropSize,
    cropSize
  );

  const imgData = cropCtx.getImageData(0, 0, cropSize, cropSize).data;
  const pixelCount = cropSize * cropSize;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    sumR += imgData[i] / 255;
    sumG += imgData[i + 1] / 255;
    sumB += imgData[i + 2] / 255;
  }
  const meanR = sumR / pixelCount;
  const meanG = sumG / pixelCount;
  const meanB = sumB / pixelCount;

  let varR = 0;
  let varG = 0;
  let varB = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i] / 255 - meanR;
    const g = imgData[i + 1] / 255 - meanG;
    const b = imgData[i + 2] / 255 - meanB;
    varR += r * r;
    varG += g * g;
    varB += b * b;
  }

  return {
    centerCropDataUrl: cropCanvas.toDataURL('image/jpeg', 0.94),
    channelStats: {
      meanR: Number(meanR.toFixed(3)),
      meanG: Number(meanG.toFixed(3)),
      meanB: Number(meanB.toFixed(3)),
      stdR: Number(Math.sqrt(varR / pixelCount).toFixed(3)),
      stdG: Number(Math.sqrt(varG / pixelCount).toFixed(3)),
      stdB: Number(Math.sqrt(varB / pixelCount).toFixed(3)),
    },
  };
}

export function preprocessImageFile(file: File): Promise<PreprocessedImageBundle> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const fullFrameDataUrl = drawResizedFullFrame(img, img.naturalWidth, img.naturalHeight);
        const { centerCropDataUrl, channelStats } = drawDogNetCenterCrop(
          img,
          img.naturalWidth,
          img.naturalHeight
        );
        resolve({
          fullFrameDataUrl,
          centerCropDataUrl,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          cropSize: 224,
          mimeType: 'image/jpeg',
          channelStats,
        });
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode the selected image file.'));
    };
    img.src = objectUrl;
  });
}

export function preprocessVideoFrame(video: HTMLVideoElement): PreprocessedImageBundle {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error('Camera video stream has no active frame dimensions yet.');
  }
  const fullFrameDataUrl = drawResizedFullFrame(video, width, height);
  const { centerCropDataUrl, channelStats } = drawDogNetCenterCrop(video, width, height);

  return {
    fullFrameDataUrl,
    centerCropDataUrl,
    originalWidth: width,
    originalHeight: height,
    cropSize: 224,
    mimeType: 'image/jpeg',
    channelStats,
  };
}
