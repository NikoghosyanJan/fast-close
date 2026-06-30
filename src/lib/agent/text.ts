/** Strip filler / question words so product names survive for direct lookup. */
const STOP_WORDS = new Set([
  // Armenian (script + common translit)
  'ինչ', 'կա', 'կա՞', 'կա՞ն', 'ունեք', 'ունի', 'չունեք', 'չկա', 'է', 'է՞', '՞',
  'barev', 'vonc', 'inchi', 'inch', 'kam', 'chi', 'du', 'yes', 'mer', 'vor', 'te',
  'ha', 'ayo', 'cheh', 'menk', 'bolor', 'karogh', 'uzum', 'karum', 'kgna', 'kapes',
  'gna', 'ela', 'ara', 'jan', 'aper', 'bari', 'lav', 'uneq', 'unem', 'unek', 'ka',
  'gnum', 'galis', 'ktor', 'gner', 'inchka', 'barer', 'taq', 'apur', 'patver',
  // Russian
  'что', 'есть', 'ли', 'у', 'вас', 'нет', 'сколько', 'стоит', 'можно', 'заказ',
  'privet', 'kak', 'chto', 'gde', 'skolko', 'est', 'net', 'da', 'nyet', 'zakaz',
  // English
  'what', 'do', 'you', 'have', 'is', 'there', 'are', 'any', 'the', 'a', 'an',
  'how', 'much', 'cost', 'price', 'can', 'i', 'get', 'order', 'want', 'please',
  'menu', 'show', 'me', 'list', 'all', 'about', 'tell', 'something', 'some',
]);

/** Clean text for substring / ILIKE matching. */
export function normalizeForSearch(text: string): string {
  return text
    .replace(/[^\u0530-\u058Fa-zA-Z0-9\u0400-\u04FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extract likely product-name phrases from the customer's last message.
 * Uses the last message only — history is for semantic search, not name match.
 */
export function extractSearchPhrases(lastMessage: string): string[] {
  const cleaned = lastMessage
    .replace(/[^\u0530-\u058Fa-zA-Z0-9\u0400-\u04FF\s?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const phrases: string[] = [];
  const normalizedFull = normalizeForSearch(cleaned);
  if (normalizedFull.length >= 2) phrases.push(normalizedFull);

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const significant = tokens.filter(t => {
    const n = normalizeForSearch(t);
    return n.length >= 2 && !STOP_WORDS.has(n);
  });

  if (significant.length >= 2) {
    phrases.push(normalizeForSearch(significant.join(' ')));
  }
  for (const token of significant) {
    if (token.length >= 2) phrases.push(normalizeForSearch(token));
  }

  return Array.from(new Set(phrases)).sort((a, b) => b.length - a.length);
}
