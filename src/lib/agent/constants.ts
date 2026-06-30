/** Small restaurant menus fit in context — skip RAG truncation entirely. */
export const FULL_MENU_PRODUCT_THRESHOLD = 40;

/** Max products injected for targeted (non-full) retrieval. */
export const RELEVANT_CONTEXT_MAX_PRODUCTS = 8;

/** Hybrid search candidate pool before merging direct matches. */
export const HYBRID_SEARCH_TOP_K = 12;
