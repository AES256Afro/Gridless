export type ActivityEntry = {
  text: string;
  date: string;
  time: string;
};

export function recordActivity(
  entries: ActivityEntry[],
  entry: ActivityEntry,
  limit = 30
) {
  if (limit <= 0) return [];
  if (entries[0]?.text === entry.text) return [entry, ...entries.slice(1, limit)];
  return [entry, ...entries].slice(0, limit);
}
