export interface Profile {
  id: string;
  email: string;
  role: 'business' | 'superadmin';
  created_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  system_prompt: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | null;
  embedding?: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  client_phone: string;
  chat_summary: string | null;
  created_at: string;
}

export interface TelegramBot {
  id: string;
  business_id: string;
  bot_token: string;
  bot_username: string | null;
  webhook_set: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface MatchedProduct {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface ProductInput {
  name: string;
  description?: string;
  price?: number;
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
}
