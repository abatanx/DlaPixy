type PreviewRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// RGBAピクセル配列から PNG Data URL を生成する。
export function createImagePreviewDataUrl(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  repeatX = 1,
  repeatY = 1
): string {
  if (width <= 0 || height <= 0) {
    return '';
  }

  const requiredLength = width * height * 4;
  if (pixels.length < requiredLength) {
    return '';
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    return '';
  }

  sourceContext.putImageData(new ImageData(pixels.slice(), width, height), 0, 0);

  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = width * Math.max(1, repeatX);
  previewCanvas.height = height * Math.max(1, repeatY);
  const previewContext = previewCanvas.getContext('2d');
  if (!previewContext) {
    return sourceCanvas.toDataURL('image/png');
  }

  previewContext.imageSmoothingEnabled = false;
  for (let ty = 0; ty < Math.max(1, repeatY); ty += 1) {
    for (let tx = 0; tx < Math.max(1, repeatX); tx += 1) {
      previewContext.drawImage(sourceCanvas, tx * width, ty * height);
    }
  }

  return previewCanvas.toDataURL('image/png');
}

// キャンバス全体から指定矩形だけ切り出して PNG Data URL を生成する。
export function createRegionPreviewDataUrl(
  pixels: Uint8ClampedArray,
  canvasSize: number,
  region: PreviewRegion,
  repeatX = 1,
  repeatY = 1
): string {
  if (region.w <= 0 || region.h <= 0) {
    return '';
  }

  const regionPixels = new Uint8ClampedArray(region.w * region.h * 4);
  for (let y = 0; y < region.h; y += 1) {
    for (let x = 0; x < region.w; x += 1) {
      const sourceIndex = ((region.y + y) * canvasSize + (region.x + x)) * 4;
      const targetIndex = (y * region.w + x) * 4;
      regionPixels[targetIndex] = pixels[sourceIndex];
      regionPixels[targetIndex + 1] = pixels[sourceIndex + 1];
      regionPixels[targetIndex + 2] = pixels[sourceIndex + 2];
      regionPixels[targetIndex + 3] = pixels[sourceIndex + 3];
    }
  }

  return createImagePreviewDataUrl(regionPixels, region.w, region.h, repeatX, repeatY);
}
