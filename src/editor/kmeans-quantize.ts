/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type LabColor = {
  l: number;
  a: number;
  b: number;
};

type WeightedColorSample = {
  key: string;
  color: RgbColor;
  lab: LabColor;
  count: number;
};

export type QuantizeSelectionSource = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  visiblePixelCount: number;
  uniqueVisibleColorCount: number;
};

export type QuantizeSelectionResult = {
  pixels: Uint8ClampedArray;
  sourceColorCount: number;
  resultColorCount: number;
  visiblePixelCount: number;
  appliedColorCount: number;
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped <= 0.0031308) {
    return clamped * 12.92 * 255;
  }
  return (1.055 * clamped ** (1 / 2.4) - 0.055) * 255;
}

function rgbToLab(color: RgbColor): LabColor {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);

  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  const xr = x / 0.95047;
  const yr = y / 1.0;
  const zr = z / 1.08883;

  const transform = (value: number): number =>
    value > 0.008856 ? value ** (1 / 3) : 7.787037 * value + 16 / 116;

  const fx = transform(xr);
  const fy = transform(yr);
  const fz = transform(zr);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

function labToRgb(color: LabColor): RgbColor {
  const fy = (color.l + 16) / 116;
  const fx = fy + color.a / 500;
  const fz = fy - color.b / 200;

  const inverse = (value: number): number => {
    const cube = value ** 3;
    return cube > 0.008856 ? cube : (value - 16 / 116) / 7.787037;
  };

  const xr = inverse(fx);
  const yr = inverse(fy);
  const zr = inverse(fz);

  const x = xr * 0.95047;
  const y = yr;
  const z = zr * 1.08883;

  const linearR = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const linearG = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const linearB = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  return {
    r: clampChannel(linearToSrgb(linearR)),
    g: clampChannel(linearToSrgb(linearG)),
    b: clampChannel(linearToSrgb(linearB))
  };
}

function squaredLabDistance(left: LabColor, right: LabColor): number {
  const dl = left.l - right.l;
  const da = left.a - right.a;
  const db = left.b - right.b;
  return dl * dl + da * da + db * db;
}

function collectWeightedVisibleColors(pixels: Uint8ClampedArray): WeightedColorSample[] {
  const samples = new Map<string, WeightedColorSample>();

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha === 0) {
      continue;
    }

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const key = `${r},${g},${b}`;
    const current = samples.get(key);
    if (current) {
      current.count += 1;
      continue;
    }

    const color = { r, g, b };
    samples.set(key, {
      key,
      color,
      lab: rgbToLab(color),
      count: 1
    });
  }

  return Array.from(samples.values());
}

function pickInitialCentroids(samples: WeightedColorSample[], clusterCount: number): LabColor[] {
  const centroids: LabColor[] = [];
  if (samples.length === 0 || clusterCount <= 0) {
    return centroids;
  }

  const sortedByWeight = [...samples].sort((left, right) => right.count - left.count);
  centroids.push(sortedByWeight[0].lab);

  while (centroids.length < clusterCount) {
    let bestSample: WeightedColorSample | null = null;
    let bestScore = -1;

    for (const sample of samples) {
      const nearestDistance = centroids.reduce(
        (smallest, centroid) => Math.min(smallest, squaredLabDistance(sample.lab, centroid)),
        Number.POSITIVE_INFINITY
      );
      const weightedScore = nearestDistance * sample.count;
      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestSample = sample;
      }
    }

    if (!bestSample) {
      break;
    }
    centroids.push(bestSample.lab);
  }

  return centroids;
}

function buildColorKey(color: RgbColor): string {
  return `${color.r},${color.g},${color.b}`;
}

export function extractSelectionPixels(
  pixels: Uint8ClampedArray,
  canvasSize: number,
  selection: { x: number; y: number; w: number; h: number }
): QuantizeSelectionSource {
  const blockPixels = new Uint8ClampedArray(selection.w * selection.h * 4);
  let visiblePixelCount = 0;
  const uniqueVisibleColors = new Set<string>();

  for (let y = 0; y < selection.h; y += 1) {
    for (let x = 0; x < selection.w; x += 1) {
      const sourceIndex = ((selection.y + y) * canvasSize + (selection.x + x)) * 4;
      const targetIndex = (y * selection.w + x) * 4;
      blockPixels[targetIndex] = pixels[sourceIndex];
      blockPixels[targetIndex + 1] = pixels[sourceIndex + 1];
      blockPixels[targetIndex + 2] = pixels[sourceIndex + 2];
      blockPixels[targetIndex + 3] = pixels[sourceIndex + 3];

      if (pixels[sourceIndex + 3] === 0) {
        continue;
      }
      visiblePixelCount += 1;
      uniqueVisibleColors.add(
        `${pixels[sourceIndex]},${pixels[sourceIndex + 1]},${pixels[sourceIndex + 2]}`
      );
    }
  }

  return {
    pixels: blockPixels,
    width: selection.w,
    height: selection.h,
    visiblePixelCount,
    uniqueVisibleColorCount: uniqueVisibleColors.size
  };
}

export function suggestKMeansColorCount(uniqueVisibleColorCount: number): number {
  if (uniqueVisibleColorCount <= 1) {
    return 1;
  }
  return Math.max(1, Math.min(16, Math.round(uniqueVisibleColorCount / 2)));
}

// 選択範囲内の可視ピクセルだけを Lab 距離ベースの K-Means で減色する。
export function quantizeSelectionWithKMeans(
  source: QuantizeSelectionSource,
  targetColorCount: number,
  maxIterations = 20
): QuantizeSelectionResult {
  const weightedColors = collectWeightedVisibleColors(source.pixels);
  const sourceColorCount = weightedColors.length;
  const appliedColorCount = Math.max(1, Math.min(sourceColorCount || 1, Math.trunc(targetColorCount)));

  if (sourceColorCount === 0 || sourceColorCount <= 1 || appliedColorCount >= sourceColorCount) {
    return {
      pixels: new Uint8ClampedArray(source.pixels),
      sourceColorCount,
      resultColorCount: sourceColorCount,
      visiblePixelCount: source.visiblePixelCount,
      appliedColorCount
    };
  }

  const centroids = pickInitialCentroids(weightedColors, appliedColorCount);
  const assignments = new Array<number>(weightedColors.length).fill(0);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let hasAssignmentChange = false;

    const sums = centroids.map(() => ({
      l: 0,
      a: 0,
      b: 0,
      weight: 0
    }));

    weightedColors.forEach((sample, sampleIndex) => {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      centroids.forEach((centroid, centroidIndex) => {
        const distance = squaredLabDistance(sample.lab, centroid);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = centroidIndex;
        }
      });

      if (assignments[sampleIndex] !== nearestIndex) {
        assignments[sampleIndex] = nearestIndex;
        hasAssignmentChange = true;
      }

      const bucket = sums[nearestIndex];
      bucket.l += sample.lab.l * sample.count;
      bucket.a += sample.lab.a * sample.count;
      bucket.b += sample.lab.b * sample.count;
      bucket.weight += sample.count;
    });

    let maxShift = 0;
    sums.forEach((bucket, centroidIndex) => {
      if (bucket.weight === 0) {
        return;
      }

      const nextCentroid = {
        l: bucket.l / bucket.weight,
        a: bucket.a / bucket.weight,
        b: bucket.b / bucket.weight
      };
      maxShift = Math.max(maxShift, squaredLabDistance(centroids[centroidIndex], nextCentroid));
      centroids[centroidIndex] = nextCentroid;
    });

    if (!hasAssignmentChange || maxShift < 0.0001) {
      break;
    }
  }

  const nearestColorByKey = new Map<string, RgbColor>();
  weightedColors.forEach((sample, sampleIndex) => {
    const mappedColor = labToRgb(centroids[assignments[sampleIndex]]);
    nearestColorByKey.set(sample.key, mappedColor);
  });

  const nextPixels = new Uint8ClampedArray(source.pixels);
  const usedQuantizedColors = new Set<string>();
  for (let index = 0; index < nextPixels.length; index += 4) {
    const alpha = nextPixels[index + 3];
    if (alpha === 0) {
      continue;
    }

    const key = `${nextPixels[index]},${nextPixels[index + 1]},${nextPixels[index + 2]}`;
    const mappedColor = nearestColorByKey.get(key);
    if (!mappedColor) {
      continue;
    }

    nextPixels[index] = mappedColor.r;
    nextPixels[index + 1] = mappedColor.g;
    nextPixels[index + 2] = mappedColor.b;
    usedQuantizedColors.add(buildColorKey(mappedColor));
  }

  return {
    pixels: nextPixels,
    sourceColorCount,
    resultColorCount: usedQuantizedColors.size,
    visiblePixelCount: source.visiblePixelCount,
    appliedColorCount
  };
}
