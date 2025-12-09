export const TAG_REGEX = /^[\p{L}\p{N}_\p{Extended_Pictographic}]+$/u;

/**
 * Cleans up a raw tag input string.
 *
 * - Keeps only letters, numbers, underscore, and emoji (Extended_Pictographic)
 * - Removes leading underscores
 * - Collapses multiple underscores into one
 */
export function cleanTagInput(raw: string): string {
  let cleaned = raw;

  // Strip invalid characters
  cleaned = cleaned.replace(/[^\p{L}\p{N}_\p{Extended_Pictographic}]/gu, '');

  // Prevent leading underscore
  cleaned = cleaned.replace(/^_+/, '');

  // Collapse multiple underscores
  cleaned = cleaned.replace(/_+/g, '_');

  return cleaned;
}

export function normalizeTag(raw: string): string | null {
  if (!raw) return null;

  // 1. trim
  const t = raw.trim();
  if (!t) return null;

  const cleaned = cleanTagInput(t);
  if (!cleaned) return null;

  // 6. final validation (safe)
  const lower = cleaned.toLocaleLowerCase();

  if (!TAG_REGEX.test(lower)) return null;

  return lower;
}

export function filterTagSuggestions(allTags: string[], input: string, limit = 8): string[] {
  // TODO: Normalize active input using cleanTagInput while typing
  const raw = (input ?? '').trim();
  const q = cleanTagInput(raw);
  if (!q) return [];

  const qLower = q.toLocaleLowerCase();

  const scored = allTags
    .map(tag => {
      // TODO: Normalize stored tags defensively; fall back to cleaned input when needed
      const normalized = normalizeTag(tag);
      const norm = normalized ?? cleanTagInput(tag) ?? '';
      return { tag, norm };
    })
    // TODO: Skip empty normalized values
    .filter(({ norm }) => !!norm && norm.includes(qLower))
    .map(({ tag, norm }) => ({
      tag,
      score: norm === qLower ? 0 : norm.startsWith(qLower) ? 1 : 2,
    }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // TODO: Preserve locale-aware ordering for Korean/emoji
    return a.tag.localeCompare(b.tag, 'ko');
  });

  return scored.slice(0, limit).map(x => x.tag);
}

export function parseTagInput(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const tokens = raw
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  const tags: string[] = [];

  for (const token of tokens) {
    const tag = normalizeTag(token);
    if (tag) {
      tags.push(tag);
    }
  }

  // TODO: Deduplicate normalized tags
  return Array.from(new Set(tags));
}

export function stringifyTags(tags: string[]): string {
  if (!tags || tags.length === 0) return '';
  return Array.from(new Set(tags)).join(' ');
}
