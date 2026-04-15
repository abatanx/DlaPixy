/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { SliceExportTargetKey } from '../../shared/slice';
import type { SliceExportBundleTargetKey } from '../../shared/slice';

export type SliceExportTargetMarkKey = SliceExportTargetKey | SliceExportBundleTargetKey;

type SliceExportTargetMarkProps = {
  target: SliceExportTargetMarkKey;
  className?: string;
};

type SliceExportTargetMarksProps = {
  targets: SliceExportTargetKey[];
  className?: string;
};

const SLICE_EXPORT_TARGET_ICON_CLASS_NAMES: Record<SliceExportTargetMarkKey, string> = {
  generic: 'fa-solid fa-cube',
  apple: 'fa-brands fa-apple',
  android: 'fa-brands fa-android',
  ico: 'fa-brands fa-windows',
  icns: 'fa-solid fa-file-image'
};

const SLICE_EXPORT_TARGET_ICON_LABELS: Record<SliceExportTargetMarkKey, string> = {
  generic: 'Generic',
  apple: 'iOS',
  android: 'Android',
  ico: 'Windows ICO',
  icns: 'macOS ICNS'
};

export function SliceExportTargetMark({ target, className }: SliceExportTargetMarkProps) {
  return (
    <span
      className={joinClassNames('slice-export-target-mark', `is-${target}`, className)}
      role="img"
      aria-label={SLICE_EXPORT_TARGET_ICON_LABELS[target]}
      title={SLICE_EXPORT_TARGET_ICON_LABELS[target]}
    >
      <i className={SLICE_EXPORT_TARGET_ICON_CLASS_NAMES[target]} aria-hidden="true" />
    </span>
  );
}

export function SliceExportTargetMarks({ targets, className }: SliceExportTargetMarksProps) {
  if (targets.length === 0) {
    return null;
  }

  return (
    <div
      className={joinClassNames('slice-export-target-marks', className)}
      aria-label="有効な書き出しターゲット"
    >
      {targets.map((target) => (
        <SliceExportTargetMark key={target} target={target} />
      ))}
    </div>
  );
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter((className) => Boolean(className)).join(' ');
}
