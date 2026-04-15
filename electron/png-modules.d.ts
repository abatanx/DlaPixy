/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

declare module 'png-chunks-extract' {
  type PngChunk = {
    name: string;
    data: Uint8Array;
  };

  export default function extractChunks(data: Uint8Array): PngChunk[];
}

declare module 'png-chunks-encode' {
  type PngChunk = {
    name: string;
    data: Uint8Array;
  };

  export default function encodeChunks(chunks: PngChunk[]): Uint8Array;
}

declare module 'png-chunk-text' {
  export function encode(keyword: string, text: string): { name: 'tEXt'; data: Uint8Array };
  export function decode(data: Uint8Array): { keyword: string; text: string };
}

declare module 'to-ico' {
  export default function toIco(
    input: Array<Buffer | Uint8Array>,
    options?: {
      resize?: boolean;
      sizes?: number[];
    }
  ): Promise<Buffer>;
}
