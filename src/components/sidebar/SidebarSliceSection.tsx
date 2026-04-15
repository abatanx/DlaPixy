/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo, useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ANDROID_SLICE_EXPORT_VARIANTS,
  GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS,
  ICO_SLICE_EXPORT_VARIANTS,
  ICNS_SLICE_EXPORT_VARIANTS,
  SLICE_EXPORT_TARGET_LABELS,
  buildSimulatedBundlePaths,
  buildSimulatedExportPaths,
  resolveComputedVariantSize,
  resolveComputedVariantScalePercent,
  resolveDisplayTargetUiState,
  resolveSliceExportSettings
} from '../../editor/slice-export';
import type {
  SliceExportSettings,
  SliceExportBundleTargetKey,
  SliceExportTargetKey,
  SliceExportTargetSettings,
  SliceExportVariantDefinition
} from '../../../shared/slice';
import { getEnabledSliceExportTargets } from '../../../shared/slice';
import { SliceExportTargetMark, SliceExportTargetMarks } from '../SliceExportTargetMarks';
import type { SidebarSliceSectionProps } from './types';

const SLICE_EXPORT_TARGET_SECTIONS: Array<[SliceExportTargetKey, SliceExportVariantDefinition[]]> = [
  ['generic', GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS],
  ['apple', GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS],
  ['android', ANDROID_SLICE_EXPORT_VARIANTS],
  ['ico', ICO_SLICE_EXPORT_VARIANTS],
  ['icns', ICNS_SLICE_EXPORT_VARIANTS]
];

export const SidebarSliceSection = memo(function SidebarSliceSection({
  canvasSize,
  slices,
  selectedSliceIds,
  activeSlice,
  selectSliceFromList,
  updateActiveSliceName,
  updateActiveSliceBounds,
  updateSelectedSliceSize,
  updateSelectedSliceExportSettings,
  setStatusText
}: SidebarSliceSectionProps) {
  const [nameInput, setNameInput] = useState<string>('');
  const [xInput, setXInput] = useState<string>('0');
  const [yInput, setYInput] = useState<string>('0');
  const [wInput, setWInput] = useState<string>('1');
  const [hInput, setHInput] = useState<string>('1');
  const [activeExportTab, setActiveExportTab] = useState<SliceExportTargetKey>('generic');
  const isMultiSliceSelection = selectedSliceIds.length > 1;
  const showSingleSliceFields = !isMultiSliceSelection && activeSlice !== null;

  const exportScopeSlices = useMemo(() => {
    if (selectedSliceIds.length > 0) {
      const selectedIdSet = new Set(selectedSliceIds);
      return slices.filter((slice) => selectedIdSet.has(slice.id));
    }
    return activeSlice ? [activeSlice] : [];
  }, [activeSlice, selectedSliceIds, slices]);

  const selectedSizeDisplay = useMemo(() => {
    if (exportScopeSlices.length === 0) {
      return {
        width: '1',
        height: '1',
        mixedWidth: false,
        mixedHeight: false
      };
    }

    const widths = exportScopeSlices.map((slice) => String(slice.w));
    const heights = exportScopeSlices.map((slice) => String(slice.h));
    const firstWidth = widths[0] ?? '';
    const firstHeight = heights[0] ?? '';

    return {
      width: widths.every((value) => value === firstWidth) ? firstWidth : '',
      height: heights.every((value) => value === firstHeight) ? firstHeight : '',
      mixedWidth: widths.some((value) => value !== firstWidth),
      mixedHeight: heights.some((value) => value !== firstHeight)
    };
  }, [exportScopeSlices]);

  useEffect(() => {
    if (!activeSlice) {
      setNameInput('');
      setXInput('0');
      setYInput('0');
      return;
    }

    setNameInput(activeSlice.name);
    setXInput(String(activeSlice.x));
    setYInput(String(activeSlice.y));
  }, [activeSlice]);

  useEffect(() => {
    setWInput(selectedSizeDisplay.width);
    setHInput(selectedSizeDisplay.height);
  }, [selectedSizeDisplay.height, selectedSizeDisplay.width]);

  const exportDisplayState = useMemo(() => {
    if (exportScopeSlices.length === 0) {
      return null;
    }

    const targetStates = exportScopeSlices.map((slice) => resolveSliceExportSettings(slice));
    return {
      generic: resolveDisplayTargetUiState(
        targetStates.map((state) => state.generic),
        GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS
      ),
      apple: resolveDisplayTargetUiState(
        targetStates.map((state) => state.apple),
        GENERIC_AND_APPLE_SLICE_EXPORT_VARIANTS
      ),
      android: resolveDisplayTargetUiState(targetStates.map((state) => state.android), ANDROID_SLICE_EXPORT_VARIANTS),
      ico: resolveDisplayTargetUiState(targetStates.map((state) => state.ico), ICO_SLICE_EXPORT_VARIANTS),
      icns: resolveDisplayTargetUiState(targetStates.map((state) => state.icns), ICNS_SLICE_EXPORT_VARIANTS)
    };
  }, [exportScopeSlices]);

  const enabledTargetsBySliceId = useMemo(
    () => new Map(slices.map((slice) => [slice.id, getEnabledSliceExportTargets(slice)])),
    [slices]
  );
  const allSimulatedPaths = useMemo(() => {
    const files: Array<{ target: SliceExportTargetKey; relativePath: string; width: number; height: number }> = [];
    const seenBundlePaths = new Set<string>();

    for (const [target] of SLICE_EXPORT_TARGET_SECTIONS) {
      for (const slice of exportScopeSlices) {
        const baseName = (slice.id === activeSlice?.id ? nameInput.trim() : slice.name.trim()) || 'slice';
        const simulations = isBundleTarget(target)
          ? buildSimulatedBundlePaths({
              target,
              slice,
              settings: resolveSliceExportSettings(slice)[target],
              baseName
            })
          : buildSimulatedExportPaths({
              target,
              slice,
              settings: resolveSliceExportSettings(slice)[target],
              baseName
            });

        for (const simulation of simulations) {
          if (isBundleTarget(target)) {
            const bundleKey = `${target}:${simulation.relativePath.toLowerCase()}`;
            if (seenBundlePaths.has(bundleKey)) {
              continue;
            }
            seenBundlePaths.add(bundleKey);
          }

          files.push({
            target,
            ...simulation
          });
        }
      }
    }

    return files;
  }, [activeSlice?.id, exportScopeSlices, nameInput]);

  const getCheckedVariantCountLabel = (
    target: SliceExportTargetKey,
    variants: SliceExportVariantDefinition[]
  ): string => {
    if (!exportDisplayState) {
      return '0';
    }

    const targetDisplay = exportDisplayState[target];
    if (targetDisplay.mixed.anyVariant) {
      return '-';
    }

    return String(variants.filter((variant) => targetDisplay.variants[variant.key]?.checked).length);
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

  const commitSizeBound = (key: 'w' | 'h', rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      setWInput(selectedSizeDisplay.width);
      setHInput(selectedSizeDisplay.height);
      return;
    }

    const accepted = updateSelectedSliceSize({ [key]: parsed });
    if (!accepted) {
      setWInput(selectedSizeDisplay.width);
      setHInput(selectedSizeDisplay.height);
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

  const updateTargetExportUi = (
    target: SliceExportTargetKey,
    updater: (current: SliceExportTargetSettings) => SliceExportTargetSettings
  ) => {
    updateSelectedSliceExportSettings((current: SliceExportSettings) => ({
      ...current,
      [target]: updater(current[target])
    }));
  };

  const copySimulatedPaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0 || !navigator.clipboard?.writeText) {
      setStatusText('ファイル一覧のコピーに失敗しました', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(paths.join('\n'));
      setStatusText('ファイル一覧をコピーしました', 'success');
    } catch {
      setStatusText('ファイル一覧のコピーに失敗しました', 'error');
    }
  }, [setStatusText]);

  const renderExportTargetSection = (
    target: SliceExportTargetKey,
    variants: SliceExportVariantDefinition[]
  ) => {
    if (exportScopeSlices.length === 0 || !exportDisplayState) {
      return null;
    }

    const targetState = exportDisplayState[target];
    const isWidthDisabled = targetState.baseSizeInput.trim() !== '' && targetState.baseAxis === 'height';
    const isHeightDisabled = targetState.baseSizeInput.trim() !== '' && targetState.baseAxis === 'width';
    const widthValue = targetState.baseAxis === 'width' ? targetState.baseSizeInput : '';
    const heightValue = targetState.baseAxis === 'height' ? targetState.baseSizeInput : '';
    const baseVariantLabel = variants.find((variant) => variant.key === targetState.baseVariant)?.label ?? '基準';

    return (
      <div key={target} className="p-1 d-flex flex-column gap-2 slice-sidebar-export-target small">
        {isBundleTarget(target) ? (
          <div className="slice-sidebar-export-bundle-note">
            有効な variant を同じスライス名かつ同じ Dir ごとに 1 つの <span className="font-monospace">.{target}</span> へまとめて書き出すよ
          </div>
        ) : null}

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
                aria-label={`${SLICE_EXPORT_TARGET_LABELS[target]} の基準幅`}
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
                aria-label={`${SLICE_EXPORT_TARGET_LABELS[target]} の基準高さ`}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 slice-sidebar-export-table">
            <tbody>
              {variants.map((variant) => {
                const computedSizes = exportScopeSlices.map((slice) =>
                  resolveComputedVariantSize(slice, resolveSliceExportSettings(slice)[target], variant, variants)
                );
                const computedScales = exportScopeSlices.map((slice) =>
                  resolveComputedVariantScalePercent(slice, resolveSliceExportSettings(slice)[target], variant, variants)
                );
                const [firstComputed] = computedSizes;
                const [firstScale] = computedScales;
                const isConsistentSize =
                  computedSizes.length === 0 ||
                  computedSizes.every(
                    (computed) => computed.width === firstComputed?.width && computed.height === firstComputed?.height
                  );
                const isConsistentScale =
                  computedScales.length === 0 ||
                  computedScales.every((scale) => Math.round(scale * 10) === Math.round((firstScale ?? 0) * 10));
                const variantDisplay = targetState.variants[variant.key];
                const isBase = targetState.baseVariant === variant.key && !targetState.mixed.baseVariant;
                const showsUpscale = isConsistentScale && (firstScale ?? 0) > 100;
                return (
                  <tr
                    key={variant.key}
                    className={variantDisplay.checked || variantDisplay.mixed ? 'table-success-subtle' : undefined}
                  >
                    <td className="text-nowrap">
                      <label className="d-inline-flex align-items-center gap-2 small fw-semibold mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={variantDisplay.checked}
                          ref={(element) => {
                            if (element) {
                              element.indeterminate = variantDisplay.mixed;
                            }
                          }}
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
                      className={`text-end font-monospace small ${isBase ? 'fw-semibold' : ''} ${
                        showsUpscale ? 'text-danger' : isBase ? 'text-body-emphasis' : 'text-body-secondary'
                      }`}
                    >
                      {isConsistentSize && isConsistentScale && firstComputed ? (
                        `${firstComputed.width}×${firstComputed.height} (${formatScalePercent(firstScale ?? 100)})`
                      ) : (
                        <span className="fst-italic">混在</span>
                      )}
                    </td>
                    <td className="text-end">
                      <label className="d-inline-flex align-items-center gap-1 small text-body-secondary">
                        <input
                          className="form-check-input"
                          type="radio"
                          name={`slice-export-base-${target}`}
                          checked={isBase}
                          onChange={() =>
                            updateTargetExportUi(target, (current) => ({
                              ...current,
                              baseVariant: variant.key
                            }))
                          }
                          aria-label={`${variant.label} を基準にする`}
                        />
                        <span>基準</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="input-group input-group-sm">
          <span className="input-group-text" aria-label="出力先ディレクトリ" title="出力先ディレクトリ">
            <i className="fa-solid fa-folder-open" aria-hidden="true" />
          </span>
          <input
            type="text"
            className="form-control"
            value={targetState.directoryTemplates}
            placeholder={targetState.mixed.directoryTemplates ? '混在' : undefined}
            onChange={(event) =>
              updateTargetExportUi(target, (current) => ({
                ...current,
                directoryTemplates: event.target.value
              }))
            }
          />
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
              const enabledTargets = enabledTargetsBySliceId.get(slice.id) ?? [];
              return (
                <div
                  key={slice.id}
                  className={`list-group-item slice-sidebar-item ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
                >
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
                    <div className="slice-sidebar-item-content">
                      <span className="slice-sidebar-item-name">{slice.name || 'slice'}</span>
                      <SliceExportTargetMarks
                        targets={enabledTargets}
                        className="slice-sidebar-item-targets"
                      />
                      <span className="slice-sidebar-item-meta">
                        {slice.x},{slice.y} / {slice.w}x{slice.h}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-body-secondary small p-3">スライスはまだありません。canvas 上をドラッグして追加してください。</div>
        )}
      </div>

      <div className="border rounded p-3 d-flex flex-column gap-3">
        {isMultiSliceSelection ? null : (
          <div className="input-group input-group-sm">
            <span className="input-group-text" aria-label="名前" title="名前">
              <i className="fa-solid fa-tag" aria-hidden="true" />
            </span>
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
        )}

        <div className="d-flex flex-column gap-2">
          {showSingleSliceFields ? (
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
          ) : null}

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
              disabled={exportScopeSlices.length === 0}
              placeholder={selectedSizeDisplay.mixedWidth ? '混在' : undefined}
              onChange={(event) => setWInput(event.target.value)}
              onBlur={() => commitSizeBound('w', wInput)}
              onKeyDown={(event) => handleFieldKeyDown(event, () => commitSizeBound('w', wInput))}
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
              disabled={exportScopeSlices.length === 0}
              placeholder={selectedSizeDisplay.mixedHeight ? '混在' : undefined}
              onChange={(event) => setHInput(event.target.value)}
              onBlur={() => commitSizeBound('h', hInput)}
              onKeyDown={(event) => handleFieldKeyDown(event, () => commitSizeBound('h', hInput))}
            />
          </div>
        </div>
      </div>

      {exportScopeSlices.length > 0 ? (
        <div className="d-flex flex-column gap-2">
          <ul className="nav nav-tabs sidebar-slice-export-tabs small" role="tablist">
            {SLICE_EXPORT_TARGET_SECTIONS.map(([target, variants]) => (
              <li key={target} className="nav-item" role="presentation">
                <button
                  type="button"
                  className={`nav-link ${activeExportTab === target ? 'active' : ''}`}
                  role="tab"
                  aria-selected={activeExportTab === target}
                  aria-controls={`sidebar-slice-export-pane-${target}`}
                  onClick={() => setActiveExportTab(target)}
                >
                  <span className="sidebar-slice-export-tab-label">
                    <SliceExportTargetMark target={target} className="sidebar-slice-export-tab-icon" />
                    <span>{SLICE_EXPORT_TARGET_LABELS[target]}</span>
                  </span>
                  <span className="badge text-bg-light border text-body-secondary">
                    {getCheckedVariantCountLabel(target, variants)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="tab-content overflow-auto pt-1">
            {SLICE_EXPORT_TARGET_SECTIONS.map(([target, variants]) => (
              <div
                key={target}
                id={`sidebar-slice-export-pane-${target}`}
                className={`tab-pane fade ${activeExportTab === target ? 'show active' : ''}`}
                role="tabpanel"
              >
                {renderExportTargetSection(target, variants)}
              </div>
            ))}
          </div>

          <div className="d-flex flex-column gap-1 slice-sidebar-export-files">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <div className="small text-body-secondary">{allSimulatedPaths.length} File(s)</div>
              <button
                type="button"
                className="canvas-copy-btn"
                onClick={() => void copySimulatedPaths(allSimulatedPaths.map(({ relativePath }) => relativePath))}
                disabled={allSimulatedPaths.length === 0}
                aria-label="ファイル一覧をコピー"
                title="ファイル一覧をコピー"
              >
                <i className="fa-regular fa-copy" aria-hidden="true" />
              </button>
            </div>
            <div className="small font-monospace text-body-secondary d-flex flex-column gap-1">
              {allSimulatedPaths.length > 0 ? (
                allSimulatedPaths.map(({ target, relativePath, width, height }, index) => (
                  <div
                    key={`${index}:${target}:${relativePath}-${width}x${height}`}
                    className="slice-sidebar-export-file-item"
                  >
                    <SliceExportTargetMark target={target} className="slice-sidebar-export-file-icon" />
                    <span>
                      {relativePath}
                      {width > 0 && height > 0 ? ` (${width}x${height})` : ''}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-body-tertiary">選択されたバリアントがありません</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});

function formatScalePercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function isBundleTarget(target: SliceExportTargetKey): target is SliceExportBundleTargetKey {
  return target === 'ico' || target === 'icns';
}
