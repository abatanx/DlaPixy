import {
  normalizeColorHex,
  normalizePaletteCaption,
  normalizePaletteEntries,
  type PaletteEntry
} from './palette';

const GPL_HEADER = 'GIMP Palette';
const ASEPRITE_ALPHA_HEADER = 'Channels: RGBA';
const DEFAULT_EXPORT_NAME = 'DlaPixy Palette';
const DEFAULT_EXPORT_ENTRY_NAME = 'Untitled';
export type GplExportFormat = 'rgb' | 'rgba';
type GplSerializeFormat = GplExportFormat | 'auto';

type ParsedGplPalette = {
  entries: PaletteEntry[];
  hasAlpha: boolean;
  name: string | null;
};

function toHex8(r: number, g: number, b: number, a: number): string {
  return `#${[r, g, b, a].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeImportedCaption(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === DEFAULT_EXPORT_ENTRY_NAME) {
    return '';
  }
  return normalizePaletteCaption(trimmed);
}

function normalizeExportName(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed || DEFAULT_EXPORT_NAME;
}

function normalizeExportEntryName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_EXPORT_ENTRY_NAME;
  }
  return trimmed.replace(/\s+/g, '_');
}

function formatChannel(value: number): string {
  return String(value).padStart(3, ' ');
}

function parseChannel(value: string, lineNo: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
    throw new Error(`GPL の数値が不正です (${lineNo} 行目)`);
  }
  return parsed;
}

function parseRgbLine(line: string, lineNo: number, hasAlpha: boolean): PaletteEntry {
  const match = hasAlpha
    ? line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(.*))?$/)
    : line.match(/^(\d+)\s+(\d+)\s+(\d+)(?:\s+(.*))?$/);

  if (!match) {
    throw new Error(`GPL の色定義が不正です (${lineNo} 行目)`);
  }

  const r = parseChannel(match[1], lineNo);
  const g = parseChannel(match[2], lineNo);
  const b = parseChannel(match[3], lineNo);
  const a = hasAlpha ? parseChannel(match[4], lineNo) : 255;
  const rawName = hasAlpha ? match[5] : match[4];

  return {
    color: toHex8(r, g, b, a),
    caption: normalizeImportedCaption(rawName),
    locked: false
  };
}

export function parseGplPalette(source: string): ParsedGplPalette {
  const normalizedSource = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalizedSource.split('\n');

  if ((lines[0] ?? '').trim() !== GPL_HEADER) {
    throw new Error('GPL ヘッダが見つかりません');
  }

  const entries: PaletteEntry[] = [];
  let hasAlpha = false;
  let name: string | null = null;

  for (let index = 1; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const line = rawLine.trim();
    const lineNo = index + 1;

    if (!line || line.startsWith('#')) {
      continue;
    }

    if (!/^\d/.test(line)) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex >= 0) {
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (key === 'Name') {
          name = value || null;
        } else if (key === 'Channels') {
          hasAlpha = value === 'RGBA';
        }
      }
      continue;
    }

    entries.push(parseRgbLine(line, lineNo, hasAlpha));
  }

  const normalizedEntries = normalizePaletteEntries(entries);
  if (normalizedEntries.length === 0) {
    throw new Error('GPL から色を 1 件も読み込めませんでした');
  }

  return {
    entries: normalizedEntries,
    hasAlpha,
    name
  };
}

export function serializeGplPalette(
  entries: PaletteEntry[],
  options?: {
    name?: string;
    format?: GplSerializeFormat;
  }
): string {
  const normalizedEntries = normalizePaletteEntries(entries);
  if (normalizedEntries.length === 0) {
    throw new Error('書き出すパレットが空です');
  }

  const hasAlpha = normalizedEntries.some((entry) => {
    const color = normalizeColorHex(entry.color);
    return color ? color.slice(7, 9) !== 'ff' : false;
  });
  const format = options?.format ?? 'auto';

  if (format === 'rgb' && hasAlpha) {
    throw new Error('alpha を含むパレットは標準 GPL で書き出せません。Aseprite向け RGBA GPL を選んでください');
  }

  const includeAlphaChannel = format === 'rgba' || (format === 'auto' && hasAlpha);

  const lines = [
    GPL_HEADER,
    `Name: ${normalizeExportName(options?.name)}`,
    'Columns: 0',
    ...(includeAlphaChannel ? [ASEPRITE_ALPHA_HEADER] : []),
    '#'
  ];

  for (const entry of normalizedEntries) {
    const color = normalizeColorHex(entry.color);
    if (!color) {
      continue;
    }
    const r = Number.parseInt(color.slice(1, 3), 16);
    const g = Number.parseInt(color.slice(3, 5), 16);
    const b = Number.parseInt(color.slice(5, 7), 16);
    const a = Number.parseInt(color.slice(7, 9), 16);
    const name = normalizeExportEntryName(entry.caption);

    lines.push(
      includeAlphaChannel
        ? `${formatChannel(r)} ${formatChannel(g)} ${formatChannel(b)} ${formatChannel(a)} ${name}`
        : `${formatChannel(r)} ${formatChannel(g)} ${formatChannel(b)} ${name}`
    );
  }

  return `${lines.join('\n')}\n`;
}
