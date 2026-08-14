/**
 * A task identifier that can be produced in either runtime.
 *
 * This is the only thing that stood between the task builder and the browser, and
 * `node:crypto` was too high a price for it: it meant the offline page had to carry a
 * second, hand-written copy of the builder, which is exactly how the page ended up
 * silently dropping maintainer policy overrides.
 *
 * `crypto.randomUUID` needs a secure context, and a page opened from `file://` is not
 * guaranteed to be one, so the fallback is not decorative. The id only has to be unique
 * within one report — `task_id` is an opaque string in the schema, not a UUID.
 */
/** Structural, because this file is compiled without the DOM lib and runs in both. */
interface WebCryptoish {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

export function newTaskId(): string {
  const cryptoRef = (globalThis as { crypto?: WebCryptoish }).crypto;

  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  if (typeof cryptoRef?.getRandomValues === 'function') {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort. Weaker, but a colliding id costs a confusing filename, nothing more.
  let out = '';
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}`;
}
