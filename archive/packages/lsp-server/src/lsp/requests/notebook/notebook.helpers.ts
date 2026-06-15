export function cellDocumentUri(document: string | { uri: string }): string {
  return typeof document === "string" ? document : document.uri;
}
