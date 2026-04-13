/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { SidebarSliceSectionProps } from './types';

type SliceExportTargetKey = 'generic' | 'apple' | 'android';
type SliceExportAxis = 'width' | 'height';

type SliceExportVariantDefinition = {
  key: string;
  label: string;
  scale: number;
};

type SliceExportTargetUiState = {
  baseVariant: string;
  baseAxis: SliceExportAxis;
  baseSizeInput: string;
  variants: Record<string, boolean>;
  directoryTemplates: string;
};

type SliceExportUiState = Record<SliceExportTargetKey, SliceExportTargetUiState>;

const GENERIC_AND_APPLE_VARIANTS: SliceExportVariantDefinition[] = [
  { key: '1x', label: '1x', scale: 1 },
  { key: '@2x', label: '@2x', scale: 2 },
  { key: '@3x', label: '@3x', scale: 3 },
  { key: '@4x', label: '@4x', scale: 4 }
];

const ANDROID_VARIANTS: SliceExportVariantDefinition[] = [
  { key: 'ldpi', label: 'ldpi', scale: 0.75 },
  { key: 'mdpi', label: 'mdpi', scale: 1 },
  { key: 'hdpi', label: 'hdpi', scale: 1.5 },
  { key: 'xhdpi', label: 'xhdpi', scale: 2 },
  { key: 'xxhdpi', label: 'xxhdpi', scale: 3 },
  { key: 'xxxhdpi', label: 'xxxhdpi', scale: 4 }
];

const SLICE_EXPORT_TARGET_LABELS: Record<SliceExportTargetKey, string> = {
  generic: 'Generic',
  apple: 'iOS',
  android: 'Android'
};

function resolveDirectoryPlaceholder(target: SliceExportTargetKey, variant: SliceExportVariantDefinition): string {
  if (target === 'android') {
    return variant.key;
  }
  return variant.key.replace(/^@/, '');
}

function buildSimulatedExportPaths(args: {
  target: SliceExportTargetKey;
  slice: { w: number; h: number };
  variants: SliceExportVariantDefinition[];
  state: SliceExportTargetUiState;
  baseName: string;
}): Array<{ relativePath: string; width: number; height: number }> {
  const directoryTemplates = args.state.directoryTemplates
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const directories = directoryTemplates.length > 0 ? directoryTemplates : [''];

  return args.variants
    .filter((variant) => args.state.variants[variant.key])
    .flatMap((variant) => {
      const computed = resolveComputedVariantSize(args.slice, args.state, variant, args.variants);
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

function createDefaultTargetUiState(
  axisSize: number,
  baseVariant: string,
  variants: SliceExportVariantDefinition[],
  directoryTemplates = ''
): SliceExportTargetUiState {
  return {
    baseVariant,
    baseAxis: 'width',
    baseSizeInput: String(axisSize),
    variants: Object.fromEntries(variants.map((variant) => [variant.key, variant.key === baseVariant])),
    directoryTemplates
  };
}

function createDefaultSliceExportUiState(slice: { w: number }): SliceExportUiState {
  return {
    generic: createDefaultTargetUiState(slice.w, '1x', GENERIC_AND_APPLE_VARIANTS),
    apple: createDefaultTargetUiState(slice.w, '1x', GENERIC_AND_APPLE_VARIANTS),
    android: createDefaultTargetUiState(slice.w, 'mdpi', ANDROID_VARIANTS, 'drawable-{density}')
  };
}

function resolveComputedVariantSize(
  slice: { w: number; h: number },
  state: SliceExportTargetUiState,
  variant: SliceExportVariantDefinition,
  variants: SliceExportVariantDefinition[]
): { width: number; height: number; isBase: boolean } {
  const baseScale = variants.find((candidate) => candidate.key === state.baseVariant)?.scale ?? variants[0]?.scale ?? 1;
  const rawBaseSize = Number.parseInt(state.baseSizeInput, 10);
  const baseAxisSize = Math.max(1, Number.isFinite(rawBaseSize) ? rawBaseSize : state.baseAxis === 'width' ? slice.w : slice.h);
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

export const SidebarSliceSection = memo(function SidebarSliceSection({
  canvasSize,
  slices,
  selectedSliceIds,
  activeSlice,
  selectSliceFromList,
  updateActiveSliceName,
  updateActiveSliceBounds
}: SidebarSliceSectionProps) {
  const [nameInput, setNameInput] = useState<string>('');
  const [xInput, setXInput] = useState<string>('0');
  const [yInput, setYInput] = useState<string>('0');
  const [wInput, setWInput] = useState<string>('1');
  const [hInput, setHInput] = useState<string>('1');
  const [activeExportTab, setActiveExportTab] = useState<SliceExportTargetKey>('generic');
  const [exportUiBySliceId, setExportUiBySliceId] = useState<Record<string, SliceExportUiState>>({});

  useEffect(() => {
    if (!activeSlice) {
      setNameInput('');
      setXInput('0');
      setYInput('0');
      setWInput('1');
      setHInput('1');
      return;
    }

    setNameInput(activeSlice.name);
    setXInput(String(activeSlice.x));
    setYInput(String(activeSlice.y));
    setWInput(String(activeSlice.w));
    setHInput(String(activeSlice.h));
  }, [activeSlice]);

  useEffect(() => {
    setExportUiBySliceId((current) => {
      const next: Record<string, SliceExportUiState> = { ...current };
      const sliceIds = new Set(slices.map((slice) => slice.id));
      let changed = false;

      for (const sliceId of Object.keys(next)) {
        if (sliceIds.has(sliceId)) {
          continue;
        }
        delete next[sliceId];
        changed = true;
      }

      for (const slice of slices) {
        if (next[slice.id]) {
          continue;
        }
        next[slice.id] = createDefaultSliceExportUiState(slice);
        changed = true;
      }

      return changed ? next : current;
    });
  }, [slices]);

  const activeExportUi = activeSlice ? exportUiBySliceId[activeSlice.id] ?? createDefaultSliceExportUiState(activeSlice) : null;

  const getCheckedVariantCount = (target: SliceExportTargetKey, variants: SliceExportVariantDefinition[]): number => {
    if (!activeExportUi) {
      return 0;
    }
    return variants.filter((variant) => activeExportUi[target].variants[variant.key]).length;
  };

  const handleSliceClick = (event: ReactMouseEvent<HTMLElement>, sliceId: string) => {
    const selectionMode = event.shiftKey ? 'range' : event.metaKey || event.ctrlKey ? 'toggle' : 'replace';
    selectSliceFromList(sliceId, selectionMode);
  };

  const handleSliceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, sliceId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    const selectionMode = event.shiftKey ? 'range' : event.metaKey || event.ctrlKey ? 'toggle' : 'replace';
    selectSliceFromList(sliceId, selectionMode);
  };

  const commitName = () => {
    if (!activeSlice) {
      return;
    }
    const accepted = updateActiveSliceName(nameInput);
    if (!accepted) {
      setNameInput(activeSlice.name);
    }
  };

  const commitBound = (key: 'x' | 'y' | 'w' | 'h', rawValue: string) => {
    if (!activeSlice) {
      return;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      if (key === 'x') {
        setXInput(String(activeSlice.x));
      } else if (key === 'y') {
        setYInput(String(activeSlice.y));
      } else if (key === 'w') {
        setWInput(String(activeSlice.w));
      } else {
        setHInput(String(activeSlice.h));
      }
      return;
    }

    const accepted = updateActiveSliceBounds({ [key]: parsed });
    if (!accepted) {
      if (key === 'x') {
        setXInput(String(activeSlice.x));
      } else if (key === 'y') {
        setYInput(String(activeSlice.y));
      } else if (key === 'w') {
        setWInput(String(activeSlice.w));
      } else {
        setHInput(String(activeSlice.h));
      }
    }
  };

  const handleFieldKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, onCommit: () => void) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    onCommit();
    event.currentTarget.blur();
  };

  const updateActiveExportUi = (updater: (current: SliceExportUiState) => SliceExportUiState) => {
    if (!activeSlice) {
      return;
    }

    setExportUiBySliceId((current) => {
      const currentState = current[activeSlice.id] ?? createDefaultSliceExportUiState(activeSlice);
      const nextState = updater(currentState);
      if (nextState === currentState) {
        return current;
      }
      return {
        ...current,
        [activeSlice.id]: nextState
      };
    });
  };

  const updateTargetExportUi = (
    target: SliceExportTargetKey,
    updater: (current: SliceExportTargetUiState) => SliceExportTargetUiState
  ) => {
    updateActiveExportUi((current) => ({
      ...current,
      [target]: updater(current[target])
    }));
  };

  const renderExportTargetSection = (
    target: SliceExportTargetKey,
    variants: SliceExportVariantDefinition[]
  ) => {
    if (!activeSlice || !activeExportUi) {
      return null;
    }

    const targetState = activeExportUi[target];
    const hasBaseSize = targetState.baseSizeInput.trim() !== '';
    const isWidthDisabled = hasBaseSize && targetState.baseAxis === 'height';
    const isHeightDisabled = hasBaseSize && targetState.baseAxis === 'width';
    const widthValue = targetState.baseAxis === 'width' ? targetState.baseSizeInput : '';
    const heightValue = targetState.baseAxis === 'height' ? targetState.baseSizeInput : '';
    const baseVariantLabel = variants.find((variant) => variant.key === targetState.baseVariant)?.label ?? targetState.baseVariant;
    const simulatedPaths = buildSimulatedExportPaths({
      target,
      slice: activeSlice,
      variants,
      state: targetState,
      baseName: (nameInput.trim() || activeSlice.name || 'slice').trim() || 'slice'
    });

    return (
      <div key={target} className="p-1 d-flex flex-column gap-2 slice-sidebar-export-target small">
        <div className="row g-2">
          <div className="col-12">
            <div className="input-group input-group-sm flex-nowrap">
              <span className="input-group-text">{baseVariantLabel}</span>
              <input
                type="number"
                className={`form-control text-end ${isWidthDisabled ? 'bg-body-tertiary text-body-secondary' : ''}`}
                min={1}
                value={widthValue}
                disabled={isWidthDisabled}
                onChange={(event) =>
                  updateTargetExportUi(target, (current) => ({
                    ...current,
                    baseAxis: 'width',
                    baseSizeInput: event.target.value
                  }))
                }
                aria-label={`${SLICE_EXPORT_TARGET_LABELS[target]} base width`}
              />
              <span className="input-group-text" aria-hidden="true">
                <i className="fa-solid fa-xmark" />
              </span>
              <input
                type="number"
                className={`form-control text-end ${isHeightDisabled ? 'bg-body-tertiary text-body-secondary' : ''}`}
                min={1}
                value={heightValue}
                disabled={isHeightDisabled}
                onChange={(event) =>
                  updateTargetExportUi(target, (current) => ({
                    ...current,
                    baseAxis: 'height',
                    baseSizeInput: event.target.value
                  }))
                }
                aria-label={`${SLICE_EXPORT_TARGET_LABELS[target]} base height`}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 slice-sidebar-export-table">
            <tbody>
              {variants.map((variant) => {
                const computed = resolveComputedVariantSize(activeSlice, targetState, variant, variants);
                return (
                  <tr
                    key={variant.key}
                    className={targetState.variants[variant.key] ? 'table-success-subtle' : undefined}
                  >
                    <td className="text-nowrap">
                      <label className="d-inline-flex align-items-center gap-2 small fw-semibold mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={targetState.variants[variant.key] ?? false}
                          onChange={(event) =>
                            updateTargetExportUi(target, (current) => ({
                              ...current,
                              variants: {
                                ...current.variants,
                                [variant.key]: event.target.checked
                              }
                            }))
                          }
                        />
                        <span>{variant.label}</span>
                      </label>
                    </td>
                    <td
                      className={`text-end font-monospace small ${
                        computed.isBase ? 'fw-semibold text-body-emphasis' : 'text-body-secondary'
                      }`}
                    >
                      {computed.width}×{computed.height}
                    </td>
                    <td className="text-end">
                      <label className="d-inline-flex align-items-center gap-1 small text-body-secondary">
                        <input
                          className="form-check-input"
                          type="radio"
                          name={`slice-export-base-${activeSlice.id}-${target}`}
                          checked={computed.isBase}
                          onChange={() =>
                            updateTargetExportUi(target, (current) => ({
                              ...current,
                              baseVariant: variant.key
                            }))
                          }
                          aria-label={`${variant.label} を基準にする`}
                        />
                        <span>Base</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="input-group input-group-sm">
          <span className="input-group-text">Dirs</span>
          <input
            type="text"
            className="form-control"
            value={targetState.directoryTemplates}
            onChange={(event) =>
              updateTargetExportUi(target, (current) => ({
                ...current,
                directoryTemplates: event.target.value
              }))
            }
          />
        </div>

        <div className="d-flex flex-column gap-1">
          <div className="small text-body-secondary">Files</div>
          <div className="small font-monospace text-body-secondary d-flex flex-column gap-1">
            {simulatedPaths.length > 0 ? (
              simulatedPaths.map(({ relativePath, width, height }) => (
                <div key={`${relativePath}-${width}x${height}`}>
                  {relativePath} ({width}x{height})
                </div>
              ))
            ) : (
              <div className="text-body-tertiary">checked variant がないよ</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between">
        <label className="form-label font-monospace small mb-0">Slice</label>
        <span className="text-body-secondary small">{selectedSliceIds.length} / {slices.length}</span>
      </div>

      <div className="slice-sidebar-list border rounded overflow-auto">
        {slices.length > 0 ? (
          <div className="list-group list-group-flush">
            {slices.map((slice, index) => {
              const isSelected = selectedSliceIds.includes(slice.id);
              const isActive = activeSlice?.id === slice.id;
              return (
                <div key={slice.id} className={`list-group-item slice-sidebar-item ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}>
                  <div
                    className="slice-sidebar-item-main user-select-none"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={(event) => handleSliceClick(event, slice.id)}
                    onKeyDown={(event) => handleSliceKeyDown(event, slice.id)}
                    title={`${slice.name || 'slice'} (${slice.x},${slice.y}, ${slice.w}x${slice.h})`}
                  >
                    <span className="slice-sidebar-item-index">#{index + 1}</span>
                    <span className="slice-sidebar-item-name">{slice.name || 'slice'}</span>
                    <span className="slice-sidebar-item-meta">{slice.x},{slice.y} / {slice.w}x{slice.h}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-body-secondary small p-3">
            まだ slice はないよ。canvas 上をドラッグして追加してね。
          </div>
        )}
      </div>

      <div className="border rounded p-3 d-flex flex-column gap-3">
        <div className="small text-body-secondary">
          {activeSlice ? `Active: ${activeSlice.name || 'slice'}` : 'Active: -'}
        </div>
        <div className="input-group input-group-sm">
          <span className="input-group-text">名前</span>
          <input
            type="text"
            className="form-control"
            value={nameInput}
            disabled={!activeSlice}
            onChange={(event) => setNameInput(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => handleFieldKeyDown(event, commitName)}
          />
        </div>

        <div className="d-flex flex-column gap-2">
          <div className="input-group input-group-sm flex-nowrap slice-sidebar-bounds-group">
            <span className="input-group-text" aria-label="位置 (X/Y)" title="位置 (X/Y)">
              <i className="fa-solid fa-location-crosshairs" aria-hidden="true" />
            </span>
            <input
              type="number"
              className="form-control text-end"
              min={0}
              max={canvasSize - 1}
              value={xInput}
              disabled={!activeSlice}
              onChange={(event) => setXInput(event.target.value)}
              onBlur={() => commitBound('x', xInput)}
              onKeyDown={(event) => handleFieldKeyDown(event, () => commitBound('x', xInput))}
            />
            <span className="input-group-text" aria-hidden="true">
              <i className="fa-solid fa-xmark" />
            </span>
            <input
              type="number"
              className="form-control text-end"
              min={0}
              max={canvasSize - 1}
              value={yInput}
              disabled={!activeSlice}
              onChange={(event) => setYInput(event.target.value)}
              onBlur={() => commitBound('y', yInput)}
              onKeyDown={(event) => handleFieldKeyDown(event, () => commitBound('y', yInput))}
            />
          </div>

          <div className="input-group input-group-sm flex-nowrap slice-sidebar-bounds-group">
            <span className="input-group-text" aria-label="サイズ (W/H)" title="サイズ (W/H)">
              <i className="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true" />
            </span>
            <input
              type="number"
              className="form-control text-end"
              min={1}
              max={canvasSize}
              value={wInput}
              disabled={!activeSlice}
              onChange={(event) => setWInput(event.target.value)}
              onBlur={() => commitBound('w', wInput)}
              onKeyDown={(event) => handleFieldKeyDown(event, () => commitBound('w', wInput))}
            />
            <span className="input-group-text" aria-hidden="true">
              <i className="fa-solid fa-xmark" />
            </span>
            <input
              type="number"
              className="form-control text-end"
              min={1}
              max={canvasSize}
              value={hInput}
              disabled={!activeSlice}
              onChange={(event) => setHInput(event.target.value)}
              onBlur={() => commitBound('h', hInput)}
              onKeyDown={(event) => handleFieldKeyDown(event, () => commitBound('h', hInput))}
            />
          </div>
        </div>
      </div>

      {activeSlice ? (
        <div className="d-flex flex-column gap-2">
          <ul className="nav nav-tabs sidebar-slice-export-tabs small" role="tablist">
            {([
              ['generic', GENERIC_AND_APPLE_VARIANTS],
              ['apple', GENERIC_AND_APPLE_VARIANTS],
              ['android', ANDROID_VARIANTS]
            ] as Array<[SliceExportTargetKey, SliceExportVariantDefinition[]]>).map(([target, variants]) => (
              <li key={target} className="nav-item" role="presentation">
                <button
                  type="button"
                  className={`nav-link ${activeExportTab === target ? 'active' : ''}`}
                  role="tab"
                  aria-selected={activeExportTab === target}
                  aria-controls={`sidebar-slice-export-pane-${target}`}
                  onClick={() => setActiveExportTab(target)}
                >
                  <span className="sidebar-slice-export-tab-label">{SLICE_EXPORT_TARGET_LABELS[target]}</span>
                  <span className="badge text-bg-light border text-body-secondary">{getCheckedVariantCount(target, variants)}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="tab-content overflow-auto pt-1">
            <div
              id="sidebar-slice-export-pane-generic"
              className={`tab-pane fade ${activeExportTab === 'generic' ? 'show active' : ''}`}
              role="tabpanel"
            >
              {renderExportTargetSection('generic', GENERIC_AND_APPLE_VARIANTS)}
            </div>
            <div
              id="sidebar-slice-export-pane-apple"
              className={`tab-pane fade ${activeExportTab === 'apple' ? 'show active' : ''}`}
              role="tabpanel"
            >
              {renderExportTargetSection('apple', GENERIC_AND_APPLE_VARIANTS)}
            </div>
            <div
              id="sidebar-slice-export-pane-android"
              className={`tab-pane fade ${activeExportTab === 'android' ? 'show active' : ''}`}
              role="tabpanel"
            >
              {renderExportTargetSection('android', ANDROID_VARIANTS)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
