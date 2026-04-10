/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { SidebarSliceSectionProps } from './types';

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

  return (
    <div className="d-flex flex-column gap-3 h-100 overflow-hidden">
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
    </div>
  );
});
