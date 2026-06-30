import type { ConversationPhase } from './types';
import type { SessionSnapshot } from './session';
import { extractPhoneNumber } from '@/lib/openai';

/** Classified customer intent for this turn (regex-based, no LLM cost). */
export type UserIntent =
  | 'greeting'
  | 'menu_browse'
  | 'menu_search'
  | 'add_item'
  | 'modify_cart'
  | 'view_cart'
  | 'checkout'
  | 'confirm'
  | 'delivery_info'
  | 'general';

export interface RoutedIntent {
  intent: UserIntent;
  confidence: 'high' | 'medium';
  forceFullMenu: boolean;
  reason: string;
}

const FULL_MENU_PATTERNS = [
  /what (do you have|can you offer|on the menu|menu|items|food)\b/i,
  /show (me|us) (everything|all|the menu|your menu|your items)/i,
  /^(list|see) (your |all |the )?(menu|items|food|catalog)/i,
  /ինչ ունեք/i,
  /ամբողջ մենյու/i,
  /ցույց տուր մենյուն/i,
  /что у вас/i,
  /покажите (весь )?меню/i,
  /menyu/i,
  /inchi ka/i,
  /inchi uni/i,
];

const GREETING_PATTERNS = [
  /^(barev|hello|hi|hey|privet|здравствуй|բարև|բարեւ|good (morning|evening|day))\b/i,
  /^(vonc es|inch es|как дела)\b/i,
];

const CONFIRM_PATTERNS = [
  /^(yes|yeah|yep|yup|ok|okay|confirm|confirmed|sure|correct|right)\b/i,
  /^(ha|ayo|da|ladno|конечно|подтверждаю)\b/i,
  /^(հա|այո|լավ|հաստատ|ստիպ)\b/i,
  /^(yes|confirm).*(order|patver|zakaz)/i,
];

const CHECKOUT_PATTERNS = [
  /\b(that('?s| is) (all|it)|i('?m| am) done|nothing else|no more)\b/i,
  /\b(finish|checkout|check out|place (the |my )?order)\b/i,
  /\b(patver|patvirem|patverem|avart|verj|gnum em)\b/i,
  /\b(оформ|заказать|готов|хватит|всё|все)\b/i,
  /\b(ավարտ|պատվեր|պատվիր|բավական)\b/i,
];

const VIEW_CART_PATTERNS = [
  /\b(my order|what did i order|show (my )?cart|cart summary|order summary)\b/i,
  /\b(what('?s| is) in (my )?(cart|order))\b/i,
  /\b(inch unem|inch patver|что я заказал|мой заказ|корзин)\b/i,
  /ինչ պատվ/i,
];

const ADD_ITEM_PATTERNS = [
  /\b(i want|i('?d| would) like|give me|get me|can i (have|get)|order|take)\b/i,
  /\b(add|put|throw in|include)\b/i,
  /\b(uzum|kargi|ta|ver|kazmi|ber|mek|erku|ereq)\b/i,
  /\b(хочу|дайте|добав|возьму|закаж)\b/i,
  /ուզum|տուր|ավելաց|վերց|պատվ/i,
  /\b(x\d+|×\s*\d+|\d+\s*(piece|pc|hat|հատ))\b/i,
];

const MODIFY_CART_PATTERNS = [
  /\b(remove|delete|cancel|without|no more)\b/i,
  /\b(change|update|make it)\b.*\b(quantity|to \d+)\b/i,
  /\b(հան|չէ|հեռաց|փոխ|jnk)\b/i,
  /\b(убер|удал|меньше|больше)\b/i,
];

const SEARCH_PATTERNS = [
  /\b(do you have|is there|any|what about|how much|price of|cost of)\b/i,
  /\b(uneq|unek|ka\??|gina|inch arzhe|сколько|есть ли|цена)\b/i,
  /\b(կա\??|ունեք|ինչ արժ|գին)\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

function isFirstTurn(chatMessages: { role: string; content: string }[]): boolean {
  return chatMessages.filter(m => m.role === 'user').length <= 1;
}

/**
 * Route customer message to an intent using rules + session phase.
 * No LLM call — fast and predictable.
 */
export function routeIntent(
  lastUserMessage: string,
  session: SessionSnapshot,
  chatMessages: { role: string; content: string }[]
): RoutedIntent {
  const text = lastUserMessage.trim();
  const lower = text.toLowerCase();

  if (isFirstTurn(chatMessages) && matchesAny(text, GREETING_PATTERNS)) {
    return { intent: 'greeting', confidence: 'high', forceFullMenu: false, reason: 'first-turn greeting' };
  }

  if (matchesAny(text, FULL_MENU_PATTERNS)) {
    return { intent: 'menu_browse', confidence: 'high', forceFullMenu: true, reason: 'full menu request' };
  }

  if (session.phase === 'checkout' && matchesAny(text, CONFIRM_PATTERNS)) {
    return { intent: 'confirm', confidence: 'high', forceFullMenu: false, reason: 'confirmation in checkout phase' };
  }

  if (matchesAny(text, CONFIRM_PATTERNS) && session.cart.length > 0 && session.customerPhone && session.deliveryAddress) {
    return { intent: 'confirm', confidence: 'medium', forceFullMenu: false, reason: 'confirm with complete cart' };
  }

  if (extractPhoneNumber(text) || (session.phase === 'checkout' && text.length > 8 && !matchesAny(text, CONFIRM_PATTERNS))) {
    if (extractPhoneNumber(text) || /\b(street|st\.|address|poxoc|փող|ул\.|улиц|dom|taracq|թաղ)\b/i.test(lower)) {
      return { intent: 'delivery_info', confidence: 'high', forceFullMenu: false, reason: 'phone or address detected' };
    }
  }

  if (matchesAny(text, CHECKOUT_PATTERNS) && session.cart.length > 0) {
    return { intent: 'checkout', confidence: 'high', forceFullMenu: false, reason: 'checkout signal with items in cart' };
  }

  if (matchesAny(text, VIEW_CART_PATTERNS)) {
    return { intent: 'view_cart', confidence: 'high', forceFullMenu: false, reason: 'cart summary request' };
  }

  if (matchesAny(text, MODIFY_CART_PATTERNS) && session.cart.length > 0) {
    return { intent: 'modify_cart', confidence: 'high', forceFullMenu: false, reason: 'cart modification' };
  }

  if (matchesAny(text, ADD_ITEM_PATTERNS)) {
    return { intent: 'add_item', confidence: 'high', forceFullMenu: false, reason: 'add-to-order signal' };
  }

  if (matchesAny(text, SEARCH_PATTERNS)) {
    return { intent: 'menu_search', confidence: 'high', forceFullMenu: false, reason: 'menu question' };
  }

  if (isFirstTurn(chatMessages)) {
    return { intent: 'greeting', confidence: 'medium', forceFullMenu: false, reason: 'first message default' };
  }

  if (session.cart.length > 0 && session.phase === 'ordering') {
    return { intent: 'add_item', confidence: 'medium', forceFullMenu: false, reason: 'ordering phase default' };
  }

  return { intent: 'general', confidence: 'medium', forceFullMenu: false, reason: 'fallback' };
}

export function intentPriorityGuide(intent: UserIntent, phase: ConversationPhase): string {
  const guides: Record<UserIntent, string> = {
    greeting: 'Welcome the customer warmly and ask how you can help with their order today.',
    menu_browse: 'Call search_menu with full_menu=true, then present a concise overview grouped by type if possible.',
    menu_search: 'Call search_menu with the customer query before answering about specific items or prices.',
    add_item: 'Find the product_id via search_menu if needed, then call add_to_cart. Confirm what was added and the running total.',
    modify_cart: 'Use update_cart_item to change quantities. Call get_cart to verify before replying.',
    view_cart: 'Call get_cart and summarize items and total clearly.',
    checkout: 'Call get_cart, show order summary, then ask for phone and delivery address if not yet saved.',
    confirm: 'Call get_cart to verify, then call confirm_order ONLY if customer clearly confirmed. Thank them after success.',
    delivery_info: 'Call set_delivery_info with any phone/address provided. If cart is ready, show summary and ask for confirmation.',
    general: 'Answer helpfully using search_menu when menu info is needed. Stay focused on ordering.',
  };

  return `${guides[intent]} Current phase: ${phase}.`;
}
