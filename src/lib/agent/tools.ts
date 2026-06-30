import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/** OpenAI tool definitions — cart mutations are server-side only via these tools. */
export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_menu',
      description:
        'Search the restaurant menu by item name, category, or keyword. Returns product ids, names, and prices. Use before add_to_cart when you need to find the correct product_id.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in the customer language',
          },
          full_menu: {
            type: 'boolean',
            description: 'Set true when customer asks to see the entire menu',
          },
          category: {
            type: 'string',
            description: 'Optional category filter e.g. soup, drink, dessert, pizza',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description:
        'Add a menu item to the customer cart. Requires a valid product_id from search_menu or the menu block.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'Product UUID from the menu' },
          quantity: { type: 'integer', description: 'Quantity to add (default 1)', minimum: 1 },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_cart_item',
      description: 'Update quantity for a cart item. Set quantity to 0 to remove the item.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          quantity: { type: 'integer', minimum: 0 },
        },
        required: ['product_id', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cart',
      description: 'Get the current cart contents, subtotal, phone, and delivery address on file.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_delivery_info',
      description: 'Save customer phone number and/or delivery address for the order.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Customer phone number' },
          address: { type: 'string', description: 'Delivery address' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirm_order',
      description:
        'Finalize the order after the customer explicitly confirms the summary. Validates cart, phone, and address. Call ONLY after verbal confirmation.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export type AgentToolName =
  | 'search_menu'
  | 'add_to_cart'
  | 'update_cart_item'
  | 'get_cart'
  | 'set_delivery_info'
  | 'confirm_order';

export function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Phase- and intent-aware tool allowlist — reduces wrong tool calls. */
export function getAllowedTools(
  phase: import('./types').ConversationPhase,
  intent: import('./intent-router').UserIntent
): AgentToolName[] {
  const all: AgentToolName[] = [
    'search_menu',
    'add_to_cart',
    'update_cart_item',
    'get_cart',
    'set_delivery_info',
    'confirm_order',
  ];

  const isConfirmIntent = intent === 'confirm';

  switch (intent) {
    case 'menu_browse':
    case 'menu_search':
      return ['search_menu', 'get_cart', 'add_to_cart'];
    case 'add_item':
      return ['search_menu', 'add_to_cart', 'get_cart', 'update_cart_item'];
    case 'modify_cart':
      return ['update_cart_item', 'get_cart', 'search_menu'];
    case 'view_cart':
      return ['get_cart', 'update_cart_item', 'add_to_cart'];
    case 'checkout':
      return ['get_cart', 'set_delivery_info', 'update_cart_item', 'search_menu'];
    case 'confirm':
      return ['get_cart', 'set_delivery_info', 'confirm_order'];
    case 'delivery_info':
      return ['set_delivery_info', 'get_cart', 'confirm_order'];
    case 'greeting':
    case 'general':
    default:
      break;
  }

  switch (phase) {
    case 'confirmed':
      return ['search_menu', 'get_cart', 'add_to_cart'];
    case 'checkout':
      return ['get_cart', 'set_delivery_info', 'confirm_order', 'update_cart_item', 'search_menu'];
    case 'ordering':
      return all.filter(t => t !== 'confirm_order' || isConfirmIntent);
    case 'browsing':
    case 'greeting':
      return ['search_menu', 'get_cart', 'add_to_cart', 'set_delivery_info'];
    default:
      return all;
  }
}

export function filterTools(allowed: AgentToolName[]): ChatCompletionTool[] {
  const allowedSet = new Set(allowed);
  return AGENT_TOOLS.filter(t => allowedSet.has(t.function.name as AgentToolName));
}
