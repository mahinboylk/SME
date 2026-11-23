/**
 * PostgREST returns many-to-one embeddings (e.g. `product:product_id(...)`)
 * as a single object, while one-to-many embeddings come back as arrays.
 * Older code assumed arrays; this normalizes both shapes to the first item.
 */
export function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
