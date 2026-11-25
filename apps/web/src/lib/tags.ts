/** Same rules as the API (`normalize_tag_name`): lowercase, trimmed, inner whitespace becomes `-`. */
export const normalizeTagName = (raw: string) =>
  raw.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");

/** Add `raw` to `tags` as the API will save it. Blanks and tags already present are ignored. */
export function withTag(tags: string[], raw: string): string[] {
  const tag = normalizeTagName(raw);
  if (!tag || tags.includes(tag)) return tags;
  return [...tags, tag];
}

export const MAX_TAG_SUGGESTIONS = 8;

/** Known tags that match `query`, prefix matches first, minus tags already chosen. */
export function suggestTags(known: string[], chosen: string[], query: string): string[] {
  const needle = normalizeTagName(query);
  if (!needle) return [];
  const available = known.filter((tag) => !chosen.includes(tag));
  const prefixMatches = available.filter((tag) => tag.startsWith(needle));
  const otherMatches = available.filter((tag) => !tag.startsWith(needle) && tag.includes(needle));
  return [...prefixMatches, ...otherMatches].slice(0, MAX_TAG_SUGGESTIONS);
}
