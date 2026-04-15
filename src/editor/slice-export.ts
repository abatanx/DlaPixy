/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import {
  ANDROID_SLICE_EXPORT_VARIANTS,
  GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS,
  ICO_SLICE_EXPORT_VARIANTS,
  ICNS_SLICE_EXPORT_VARIANTS,
  SLICE_EXPORT_PNG_TARGET_KEYS,
  SLICE_EXPORT_TARGET_LABELS,
  SLICE_EXPORT_VARIANTS_BY_TARGET,
  createDefaultSliceExportSettings,
  normalizeSliceExportSettings,
  type EditorSlice,
  type SliceExportAxis,
  type SliceExportBundleTargetKey,
  type SliceExportSettings,
  type SliceExportPngTargetKey,
  type SliceExportTargetKey,
  type SliceExportTargetSettings,
  type SliceExportVariantDefinition
} from '../../shared/slice';

type SliceExportVariantDisplayState = {
  checked: boolean;
  someChecked: boolean;
  mixed: boolean;
};

export type SliceExportTargetDisplayState = {
  baseVariant: string | null;
  baseAxis: SliceExportAxis | null;
  baseSizeInput: string;
  directoryTemplates: string;
  variants: Record<string, SliceExportVariantDisplayState>;
  mixed: {
    baseVariant: boolean;
    baseAxis: boolean;
    baseSizeInput: boolean;
    directoryTemplates: boolean;
    anyVariant: boolean;
  };
};

export type SliceExportSimulation = {
  relativePath: string;
  width: number;
  height: number;
};

export type SliceExportRenderPlan = SliceExportSimulation & {
  sliceId: string;
  x: number;
  y: number;
  sourceWidth: number;
  sourceHeight: number;
};

const INVALID_SLICE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f]/;
const INVALID_PATH_SEGMENT_PATTERN = /[<>:"|?*\u0000-\u001f]/;

export function resolveSliceExportSettings(slice: Pick<EditorSlice, 'w' | 'h' | 'exportSettings'>): SliceExportSettings {
  return normalizeSliceExportSettings(slice.exportSettings, slice);
}

export function resolveDisplayTargetUiState(
  states: SliceExportTargetSettings[],
  variants: SliceExportVariantDefinition[]
): SliceExportTargetDisplayState {
  const baseVariant = resolveSharedValue(states.map((state) => state.baseVariant));
  const baseAxis = resolveSharedValue(states.map((state) => state.baseAxis));
  const baseSizeInput = resolveSharedValue(states.map((state) => state.baseSizeInput));
  const directoryTemplates = resolveSharedValue(states.map((state) => state.directoryTemplates));

  const variantStates = Object.fromEntries(
    variants.map((variant) => {
      const values = states.map((state) => Boolean(state.variants[variant.key]));
      const checked = values.every(Boolean);
      const someChecked = values.some(Boolean);
      return [
        variant.key,
        {
          checked,
          someChecked,
          mixed: someChecked && !checked
        } satisfies SliceExportVariantDisplayState
      ];
    })
  );

  return {
    baseVariant: baseVariant.value,
    baseAxis: baseAxis.value,
    baseSizeInput: baseSizeInput.value ?? '',
    directoryTemplates: directoryTemplates.value ?? '',
    variants: variantStates,
    mixed: {
      baseVariant: baseVariant.mixed,
      baseAxis: baseAxis.mixed,
      baseSizeInput: baseSizeInput.mixed,
      directoryTemplates: directoryTemplates.mixed,
      anyVariant: variants.some((variant) => variantStates[variant.key]?.mixed)
    }
  };
}

export function resolveComputedVariantSize(
  slice: Pick<EditorSlice, 'w' | 'h'>,
  state: SliceExportTargetSettings,
  variant: SliceExportVariantDefinition,
  variants: SliceExportVariantDefinition[]
): { width: number; height: number; isBase: boolean } {
  const baseScale = variants.find((candidate) => candidate.key === state.baseVariant)?.scale ?? variants[0]?.scale ?? 1;
  const rawBaseSize = Number.parseInt(state.baseSizeInput, 10);
  const baseAxisSize = Math.max(
    1,
    Number.isFinite(rawBaseSize) ? rawBaseSize : state.baseAxis === 'width' ? slice.w : slice.h
  );
  const baseWidth =
    state.baseAxis === 'width'
      ? baseAxisSize
      : Math.max(1, Math.round((baseAxisSize * slice.w) / Math.max(1, slice.h)));
  const baseHeight =
    state.baseAxis === 'height'
      ? baseAxisSize
      : Math.max(1, Math.round((baseAxisSize * slice.h) / Math.max(1, slice.w)));
  const ratio = variant.scale / Math.max(baseScale, 0.0001);

  return {
    width: Math.max(1, Math.round(baseWidth * ratio)),
    height: Math.max(1, Math.round(baseHeight * ratio)),
    isBase: variant.key === state.baseVariant
  };
}

export function resolveComputedVariantScalePercent(
  slice: Pick<EditorSlice, 'w' | 'h'>,
  state: SliceExportTargetSettings,
  variant: SliceExportVariantDefinition,
  variants: SliceExportVariantDefinition[]
): number {
  const computed = resolveComputedVariantSize(slice, state, variant, variants);
  const sourceAxisSize = state.baseAxis === 'width' ? Math.max(1, slice.w) : Math.max(1, slice.h);
  const targetAxisSize = state.baseAxis === 'width' ? computed.width : computed.height;
  return (targetAxisSize / sourceAxisSize) * 100;
}

export function buildSimulatedExportPaths(args: {
  target: SliceExportPngTargetKey;
  slice: Pick<EditorSlice, 'w' | 'h'>;
  settings: SliceExportTargetSettings;
  baseName: string;
}): SliceExportSimulation[] {
  const variants = SLICE_EXPORT_VARIANTS_BY_TARGET[args.target];
  const directoryTemplates = args.settings.directoryTemplates
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const directories = directoryTemplates.length > 0 ? directoryTemplates : [''];

  return variants
    .filter((variant) => args.settings.variants[variant.key])
    .flatMap((variant) => {
      const computed = resolveComputedVariantSize(args.slice, args.settings, variant, variants);
      const density = resolveDirectoryPlaceholder(args.target, variant);
      const suffix = args.target === 'android' ? '' : variant.key === '1x' ? '' : variant.key;
      const fileName = `${args.baseName}${suffix}.png`;

      return directories.map((directoryTemplate) => {
        const relativeDirectory = directoryTemplate.replaceAll('{density}', density).replace(/^\/+|\/+$/g, '');
        return {
          relativePath: relativeDirectory.length > 0 ? `${relativeDirectory}/${fileName}` : fileName,
          width: computed.width,
          height: computed.height
        };
      });
    });
}

export function buildSimulatedBundlePaths(args: {
  target: SliceExportBundleTargetKey;
  slice: Pick<EditorSlice, 'w' | 'h'>;
  settings: SliceExportTargetSettings;
  baseName: string;
}): SliceExportSimulation[] {
  const variants = SLICE_EXPORT_VARIANTS_BY_TARGET[args.target];
  const hasEnabledVariant = variants.some((variant) => args.settings.variants[variant.key]);
  if (!hasEnabledVariant) {
    return [];
  }

  const directoryTemplates = args.settings.directoryTemplates
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const directories = directoryTemplates.length > 0 ? directoryTemplates : [''];
  const fileName = `${args.baseName}.${args.target}`;

  return directories.map((directoryTemplate) => {
    const relativeDirectory = directoryTemplate.replace(/^\/+|\/+$/g, '');
    return {
      relativePath: relativeDirectory.length > 0 ? `${relativeDirectory}/${fileName}` : fileName,
      width: 0,
      height: 0
    };
  });
}

export function buildSliceExportPlans(slices: EditorSlice[]): { plans: SliceExportRenderPlan[] } | { error: string } {
  if (slices.length === 0) {
    return { error: '書き出し対象のスライスがありません' };
  }

  const seenNames = new Set<string>();
  const seenPaths = new Set<string>();
  const plans: SliceExportRenderPlan[] = [];

  for (const slice of slices) {
    const baseName = slice.name.trim();
    if (!baseName) {
      return { error: '空のスライス名では書き出せません' };
    }
    if (baseName === '.' || baseName === '..') {
      return { error: `スライス名「${baseName}」は使用できません` };
    }
    if (INVALID_SLICE_NAME_PATTERN.test(baseName)) {
      return { error: `スライス名「${baseName}」に使用できない文字が含まれています` };
    }

    const nameKey = baseName.toLowerCase();
    if (seenNames.has(nameKey)) {
      return { error: `スライス名「${baseName}」が重複しています` };
    }
    seenNames.add(nameKey);

    const exportSettings = resolveSliceExportSettings(slice);
    let hasEnabledVariant = false;

    for (const target of SLICE_EXPORT_PNG_TARGET_KEYS) {
      const simulations = buildSimulatedExportPaths({
        target,
        slice,
        settings: exportSettings[target],
        baseName
      });

      for (const simulation of simulations) {
        hasEnabledVariant = true;
        const normalizedPath = normalizeRelativeOutputPath(simulation.relativePath);
        if (!normalizedPath.ok) {
          return {
            error: `${SLICE_EXPORT_TARGET_LABELS[target]} の出力先が不正です: ${normalizedPath.reason}`
          };
        }

        const pathKey = normalizedPath.path.toLowerCase();
        if (seenPaths.has(pathKey)) {
          return { error: `エクスポート先が重複しています: ${normalizedPath.path}` };
        }
        seenPaths.add(pathKey);

        plans.push({
          sliceId: slice.id,
          x: slice.x,
          y: slice.y,
          sourceWidth: slice.w,
          sourceHeight: slice.h,
          relativePath: normalizedPath.path,
          width: simulation.width,
          height: simulation.height
        });
      }
    }

    if (!hasEnabledVariant) {
      return { error: `スライス「${baseName}」に書き出し対象のバリアントがありません` };
    }
  }

  if (plans.length === 0) {
    return { error: '書き出し対象のバリアントがありません' };
  }

  return { plans };
}

export async function renderSliceExportFiles(args: {
  canvasSize: number;
  pixels: Uint8ClampedArray;
  plans: SliceExportRenderPlan[];
}): Promise<Array<{ relativePath: string; base64Png: string }>> {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = args.canvasSize;
  sourceCanvas.height = args.canvasSize;
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    throw new Error('書き出し用キャンバスの初期化に失敗しました');
  }
  sourceContext.putImageData(new ImageData(args.pixels.slice(), args.canvasSize, args.canvasSize), 0, 0);

  return args.plans.map((plan) => {
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = plan.width;
    targetCanvas.height = plan.height;
    const targetContext = targetCanvas.getContext('2d');
    if (!targetContext) {
      throw new Error('書き出し先キャンバスの初期化に失敗しました');
    }

    targetContext.imageSmoothingEnabled = false;
    targetContext.clearRect(0, 0, plan.width, plan.height);
    targetContext.drawImage(
      sourceCanvas,
      plan.x,
      plan.y,
      plan.sourceWidth,
      plan.sourceHeight,
      0,
      0,
      plan.width,
      plan.height
    );

    return {
      relativePath: plan.relativePath,
      base64Png: targetCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
    };
  });
}

export function getSliceExportScopeSlices(slices: EditorSlice[], selectedSliceIds: string[]): EditorSlice[] {
  if (selectedSliceIds.length === 0) {
    return slices;
  }

  const selectedIdSet = new Set(selectedSliceIds);
  return slices.filter((slice) => selectedIdSet.has(slice.id));
}

export function getDefaultSliceExportSettings(slice: Pick<EditorSlice, 'w'>): SliceExportSettings {
  return createDefaultSliceExportSettings(slice);
}

export {
  ANDROID_SLICE_EXPORT_VARIANTS,
  GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS,
  ICO_SLICE_EXPORT_VARIANTS,
  ICNS_SLICE_EXPORT_VARIANTS,
  SLICE_EXPORT_TARGET_LABELS
};

function resolveDirectoryPlaceholder(target: SliceExportTargetKey, variant: SliceExportVariantDefinition): string {
  if (target === 'android') {
    return variant.key;
  }
  return variant.key.replace(/^@/, '');
}

function resolveSharedValue<T>(values: T[]): { value: T | null; mixed: boolean } {
  if (values.length === 0) {
    return { value: null, mixed: false };
  }

  const [firstValue] = values;
  const isSame = values.every((value) => value === firstValue);
  return {
    value: isSame ? firstValue : null,
    mixed: !isSame
  };
}

function normalizeRelativeOutputPath(
  relativePath: string
): { ok: true; path: string } | { ok: false; reason: string } {
  const normalized = relativePath.trim().replaceAll('\\', '/');
  if (!normalized) {
    return { ok: false, reason: '空のパスは使用できません' };
  }
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    return { ok: false, reason: '絶対パスは使用できません' };
  }

  const segments = normalized.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return { ok: false, reason: '空のパスは使用できません' };
  }
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return { ok: false, reason: '`.` や `..` は使用できません' };
  }
  const invalidSegment = segments.find((segment) => INVALID_PATH_SEGMENT_PATTERN.test(segment));
  if (invalidSegment) {
    return { ok: false, reason: `"${invalidSegment}" に使用できない文字が含まれています` };
  }

  return { ok: true, path: segments.join('/') };
}
