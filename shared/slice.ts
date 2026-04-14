/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

export type SliceExportTargetKey = 'generic' | 'apple' | 'android';
export type SliceExportAxis = 'width' | 'height';

export type SliceExportVariantDefinition = {
  key: string;
  label: string;
  scale: number;
};

export type SliceExportTargetSettings = {
  baseVariant: string;
  baseAxis: SliceExportAxis;
  baseSizeInput: string;
  variants: Record<string, boolean>;
  directoryTemplates: string;
};

export type SliceExportSettings = Record<SliceExportTargetKey, SliceExportTargetSettings>;

export type EditorSlice = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  exportSettings?: SliceExportSettings;
};

export const SLICE_EXPORT_TARGET_KEYS: SliceExportTargetKey[] = ['generic', 'apple', 'android'];
export const GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS: SliceExportVariantDefinition[] = [
  { key: '1x', label: '1x', scale: 1 },
  { key: '@2x', label: '@2x', scale: 2 },
  { key: '@3x', label: '@3x', scale: 3 },
  { key: '@4x', label: '@4x', scale: 4 }
];
export const ANDROID_SLICE_EXPORT_VARIANTS: SliceExportVariantDefinition[] = [
  { key: 'ldpi', label: 'ldpi', scale: 0.75 },
  { key: 'mdpi', label: 'mdpi', scale: 1 },
  { key: 'hdpi', label: 'hdpi', scale: 1.5 },
  { key: 'xhdpi', label: 'xhdpi', scale: 2 },
  { key: 'xxhdpi', label: 'xxhdpi', scale: 3 },
  { key: 'xxxhdpi', label: 'xxxhdpi', scale: 4 }
];
export const SLICE_EXPORT_VARIANTS_BY_TARGET: Record<SliceExportTargetKey, SliceExportVariantDefinition[]> = {
  generic: GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS,
  apple: GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS,
  android: ANDROID_SLICE_EXPORT_VARIANTS
};
export const SLICE_EXPORT_TARGET_LABELS: Record<SliceExportTargetKey, string> = {
  generic: 'Generic',
  apple: 'iOS',
  android: 'Android'
};

export const SLICE_NAME_MAX_LENGTH = 100;
const SLICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEditorSliceId(value: unknown): value is string {
  return typeof value === 'string' && SLICE_ID_PATTERN.test(value);
}

export function generateEditorSliceId(): string {
  return globalThis.crypto.randomUUID().toLowerCase();
}

export function normalizeSliceName(value: string): string {
  return Array.from(value.trim()).slice(0, SLICE_NAME_MAX_LENGTH).join('');
}

export function createDefaultSliceExportSettings(slice: Pick<EditorSlice, 'w'>): SliceExportSettings {
  return {
    generic: createDefaultSliceExportTargetSettings(slice.w, '1x', GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS, 'generic'),
    apple: createDefaultSliceExportTargetSettings(slice.w, '1x', GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS, 'ios'),
    android: createDefaultSliceExportTargetSettings(slice.w, 'mdpi', ANDROID_SLICE_EXPORT_VARIANTS, 'drawable-{density}')
  };
}

export function normalizeSliceExportSettings(
  value: unknown,
  slice: Pick<EditorSlice, 'w' | 'h'>
): SliceExportSettings {
  const defaults = createDefaultSliceExportSettings(slice);
  if (!isRecord(value)) {
    return defaults;
  }

  return {
    generic: normalizeSliceExportTargetSettings(value.generic, defaults.generic, GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS),
    apple: normalizeSliceExportTargetSettings(value.apple, defaults.apple, GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS),
    android: normalizeSliceExportTargetSettings(value.android, defaults.android, ANDROID_SLICE_EXPORT_VARIANTS)
  };
}

export function cloneSliceExportSettings(settings: SliceExportSettings): SliceExportSettings {
  return {
    generic: cloneSliceExportTargetSettings(settings.generic),
    apple: cloneSliceExportTargetSettings(settings.apple),
    android: cloneSliceExportTargetSettings(settings.android)
  };
}

export function hasSameSliceExportSettings(left: SliceExportSettings, right: SliceExportSettings): boolean {
  return SLICE_EXPORT_TARGET_KEYS.every((target) => {
    const leftTarget = left[target];
    const rightTarget = right[target];
    const variants = SLICE_EXPORT_VARIANTS_BY_TARGET[target];
    return (
      leftTarget.baseVariant === rightTarget.baseVariant &&
      leftTarget.baseAxis === rightTarget.baseAxis &&
      leftTarget.baseSizeInput === rightTarget.baseSizeInput &&
      leftTarget.directoryTemplates === rightTarget.directoryTemplates &&
      variants.every((variant) => leftTarget.variants[variant.key] === rightTarget.variants[variant.key])
    );
  });
}

export function syncSliceExportSettingsWithSize(
  previousSlice: Pick<EditorSlice, 'w' | 'h' | 'exportSettings'>,
  nextSlice: Pick<EditorSlice, 'w' | 'h' | 'exportSettings'>
): SliceExportSettings {
  const nextSettings = normalizeSliceExportSettings(nextSlice.exportSettings ?? previousSlice.exportSettings, nextSlice);
  let changed = false;
  const synced: SliceExportSettings = cloneSliceExportSettings(nextSettings);

  for (const target of SLICE_EXPORT_TARGET_KEYS) {
    const targetSettings = nextSettings[target];
    const previousAxisSize = targetSettings.baseAxis === 'width' ? previousSlice.w : previousSlice.h;
    const nextAxisSize = targetSettings.baseAxis === 'width' ? nextSlice.w : nextSlice.h;
    if (targetSettings.baseSizeInput !== String(previousAxisSize)) {
      continue;
    }
    if (targetSettings.baseSizeInput === String(nextAxisSize)) {
      continue;
    }

    synced[target] = {
      ...targetSettings,
      baseSizeInput: String(nextAxisSize)
    };
    changed = true;
  }

  return changed ? synced : nextSettings;
}

export function isSliceExportSettings(value: unknown): value is SliceExportSettings {
  if (!isRecord(value)) {
    return false;
  }

  return SLICE_EXPORT_TARGET_KEYS.every((target) =>
    isSliceExportTargetSettings(value[target], SLICE_EXPORT_VARIANTS_BY_TARGET[target])
  );
}

function createDefaultSliceExportTargetSettings(
  axisSize: number,
  baseVariant: string,
  variants: SliceExportVariantDefinition[],
  directoryTemplates = ''
): SliceExportTargetSettings {
  return {
    baseVariant,
    baseAxis: 'width',
    baseSizeInput: String(Math.max(1, Math.trunc(axisSize))),
    variants: createSliceExportVariantSelectionMap(variants),
    directoryTemplates
  };
}

function normalizeSliceExportTargetSettings(
  value: unknown,
  defaults: SliceExportTargetSettings,
  variants: SliceExportVariantDefinition[]
): SliceExportTargetSettings {
  const candidate = isRecord(value) ? value : {};
  const variantKeys = new Set(variants.map((variant) => variant.key));
  const candidateVariants = isRecord(candidate.variants) ? candidate.variants : {};
  const baseVariant =
    typeof candidate.baseVariant === 'string' && variantKeys.has(candidate.baseVariant)
      ? candidate.baseVariant
      : defaults.baseVariant;
  const baseAxis = candidate.baseAxis === 'height' ? 'height' : defaults.baseAxis;
  const hasExplicitVariantValue = variants.some((variant) => typeof candidateVariants[variant.key] === 'boolean');
  // Older sidecars may omit `variants`; in that case preserve the historical
  // behavior where the resolved base variant was implicitly enabled.
  const legacyFallbackVariants = createSliceExportVariantSelectionMap(variants, [baseVariant]);

  return {
    baseVariant,
    baseAxis,
    baseSizeInput:
      typeof candidate.baseSizeInput === 'string' ? candidate.baseSizeInput.trim() : defaults.baseSizeInput,
    variants: Object.fromEntries(
      variants.map((variant) => [
        variant.key,
        typeof candidateVariants[variant.key] === 'boolean'
          ? candidateVariants[variant.key]
          : hasExplicitVariantValue
            ? defaults.variants[variant.key]
            : legacyFallbackVariants[variant.key]
      ])
    ) as Record<string, boolean>,
    directoryTemplates:
      typeof candidate.directoryTemplates === 'string'
        ? candidate.directoryTemplates.trim()
        : defaults.directoryTemplates
  };
}

function cloneSliceExportTargetSettings(settings: SliceExportTargetSettings): SliceExportTargetSettings {
  return {
    ...settings,
    variants: { ...settings.variants }
  };
}

function createSliceExportVariantSelectionMap(
  variants: SliceExportVariantDefinition[],
  selectedKeys: Iterable<string> = []
): Record<string, boolean> {
  const selectedKeySet = new Set(selectedKeys);
  return Object.fromEntries(variants.map((variant) => [variant.key, selectedKeySet.has(variant.key)]));
}

function isSliceExportTargetSettings(
  value: unknown,
  variants: SliceExportVariantDefinition[]
): value is SliceExportTargetSettings {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.baseVariant !== 'string' ||
    !variants.some((variant) => variant.key === value.baseVariant) ||
    (value.baseAxis !== 'width' && value.baseAxis !== 'height') ||
    typeof value.baseSizeInput !== 'string' ||
    typeof value.directoryTemplates !== 'string' ||
    !isRecord(value.variants)
  ) {
    return false;
  }

  const variantValues = value.variants;
  return variants.every((variant) => typeof variantValues[variant.key] === 'boolean');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
