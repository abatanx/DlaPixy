declare module 'png-chunks-extract' {
  type Chunk = { name: string; data: Uint8Array };
  export default function extractChunks(data: Uint8Array): Chunk[];
}

declare module 'png-chunks-encode' {
  type Chunk = { name: string; data: Uint8Array };
  export default function encodeChunks(chunks: Chunk[]): Uint8Array;
}

declare module 'png-chunk-text' {
  export function encode(keyword: string, text: string): { name: string; data: Uint8Array };
  export function decode(data: Uint8Array): { keyword: string; text: string };
}
