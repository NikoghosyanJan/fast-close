/** Map customer category words → normalized category keys for DB ILIKE search. */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  soup: ['soup', 'soups', 'sup', 'апу', 'apu', 'ապու', 'chanap', 'chanakh'],
  salad: ['salad', 'salads', 'salat', 'saladik', 'աղց', 'aghc'],
  main: ['main', 'mains', 'entree', 'plate', 'khorovats', 'kebab', 'bbq', 'հավ'],
  pizza: ['pizza', 'pizzas', 'pica', 'պից'],
  burger: ['burger', 'burgers', 'hamberger', 'բուրգ'],
  drink: ['drink', 'drinks', 'beverage', 'coffee', 'tea', 'juice', 'cola', 'water', 'խմ', 'kofe', 'coffe', 'cay', 'jus'],
  dessert: ['dessert', 'desserts', 'sweet', 'cake', 'ice cream', 'տորթ', 'tort', 'glace'],
  appetizer: ['appetizer', 'starter', 'snack', 'side', 'nazuk', 'nazuk ban'],
  breakfast: ['breakfast', 'nash', 'nakh', 'ut', 'utener'],
};

/**
 * Extract a category hint from a customer message (regex, no LLM).
 * Returns a canonical key like "soup" or null.
 */
export function extractCategoryHint(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [key, words] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const word of words) {
      if (lower.includes(word.toLowerCase())) return key;
    }
  }
  return null;
}

/** Expand canonical key to ILIKE search terms (includes synonyms). */
export function categorySearchTerms(canonicalKey: string): string[] {
  const synonyms = CATEGORY_SYNONYMS[canonicalKey] ?? [canonicalKey];
  return [canonicalKey, ...synonyms];
}
