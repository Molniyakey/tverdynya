export function isDebugMode(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }
  return new URLSearchParams(window.location.search).get('debug') === '1';
}
