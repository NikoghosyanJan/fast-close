/**
 * Agent architecture — implementation roadmap
 *
 * Step 1 (current): Reliable RAG + honest prompts + direct name match
 * Step 2 (current): ChatSession + server-side cart + phase in DB
 * Step 3 (current): Tool definitions + executor + tool-calling agent loop
 * Step 4 (current): Intent router + phase-aware orchestrator
 * Step 5: Unified handleAgentMessage for web + Telegram (done via orchestrator)
 * Step 6 (current): Product category + aliases + embedding strategy
 * Step 7 (current): Orders via confirm_order tool only; legacy cart-sync removed from exports
 */

export type ConversationPhase =
  | 'greeting'
  | 'browsing'
  | 'ordering'
  | 'checkout'
  | 'confirmed';

export type MenuContextScope = 'full' | 'relevant' | 'empty';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface MenuContextResult {
  products: import('@/lib/rag').MatchedProduct[];
  contextText: string;
  scope: MenuContextScope;
  /** Direct DB name matches — never dropped from context */
  directMatchIds: string[];
}
