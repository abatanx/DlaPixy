/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { SliceExportBundleTargetKey } from './slice';

export type SliceExportWritePngFile = {
  kind: 'png';
  relativePath: string;
  base64Png: string;
};

export type SliceExportWriteBundleMember = {
  variantKey: string;
  base64Png: string;
};

export type SliceExportWriteBundleFile = {
  kind: 'bundle';
  format: SliceExportBundleTargetKey;
  relativePath: string;
  members: SliceExportWriteBundleMember[];
};

export type SliceExportWriteFile = SliceExportWritePngFile | SliceExportWriteBundleFile;

export type SliceExportWriteRequest = {
  files: SliceExportWriteFile[];
};
