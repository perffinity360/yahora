import { File } from 'expo-file-system';

/** A picked media asset destined for a multipart upload. */
export interface UploadAsset {
  uri: string;
  name?: string | null;
  type?: string | null;
}

/**
 * Build a multipart file part that Expo SDK 56's Winter `fetch` accepts.
 *
 * The global `fetch` is Expo's spec-compliant Winter implementation, whose
 * FormData serializer rejects React Native's classic `{ uri, name, type }` file
 * shape with "Unsupported FormDataPart implementation" — it handles only string
 * parts, real `Blob`s, or objects exposing `.bytes()` (see
 * `expo/src/winter/fetch/convertFormData.ts`). So we hand it `name`/`type` (for
 * the multipart headers) plus a lazy `bytes()` that reads the file off disk via
 * expo-file-system.
 *
 * Typed as `Blob` only to satisfy `FormData.append`; at runtime it is the plain
 * descriptor the serializer expects.
 */
export function toUploadFile({ uri, name, type }: UploadAsset): Blob {
  return {
    name: name ?? 'upload.jpg',
    type: type ?? 'image/jpeg',
    bytes: async () => new Uint8Array(await new File(uri).arrayBuffer()),
  } as unknown as Blob;
}
