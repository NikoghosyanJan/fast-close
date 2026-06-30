import { extractPhoneNumber } from '@/lib/openai';
import { runAgentTurn, runAgentTurnStreaming, type AgentTurnResult, type RunAgentTurnParams } from './run-agent';
import {
  routeIntent,
  intentPriorityGuide,
  type RoutedIntent,
  type UserIntent,
} from './intent-router';
import { getAllowedTools } from './tools';
import {
  type SessionSnapshot,
  updateSession,
  resetSessionAfterOrder,
} from './session';
import { executeAgentTool } from './tool-executor';

export interface OrchestrationContext {
  routed: RoutedIntent;
  allowedTools: ReturnType<typeof getAllowedTools>;
  orchestrationHint: string;
  preloadedCart?: Record<string, unknown>;
}

export interface HandleAgentMessageParams extends Omit<RunAgentTurnParams, 'forceFullMenu'> {
  channel: 'web' | 'telegram';
}

export type AgentStreamTurnCompleted = AgentTurnResult & { routed: RoutedIntent };

export interface AgentOrchestratedStreamResult {
  stream: ReadableStream<Uint8Array>;
  completed: Promise<AgentStreamTurnCompleted>;
  routed: RoutedIntent;
  sessionId: string;
}

function formatOrchestrationBlock(ctx: OrchestrationContext, session: SessionSnapshot): string {
  const lines = [
    '===== ORCHESTRATION (this turn — follow strictly) =====',
    `Intent: ${ctx.routed.intent} (${ctx.routed.confidence}) — ${ctx.routed.reason}`,
    `Phase: ${session.phase}`,
    `Guide: ${intentPriorityGuide(ctx.routed.intent, session.phase)}`,
    `Allowed tools: ${ctx.allowedTools.join(', ')}`,
  ];

  if (ctx.preloadedCart) {
    lines.push(`Preloaded cart snapshot: ${JSON.stringify(ctx.preloadedCart)}`);
  }

  lines.push('===== END ORCHESTRATION =====');
  return lines.join('\n');
}

async function applyPhaseTransition(
  session: SessionSnapshot,
  businessId: string,
  intent: UserIntent
): Promise<SessionSnapshot> {
  if (session.phase === 'confirmed' && intent !== 'general' && intent !== 'greeting') {
    return updateSession(session.id, businessId, {
      phase: 'browsing',
      cart: [],
      customerPhone: null,
      deliveryAddress: null,
    });
  }

  if (intent === 'checkout' && session.cart.length > 0) {
    return updateSession(session.id, businessId, { phase: 'checkout' });
  }

  if ((intent === 'add_item' || intent === 'modify_cart') && session.phase === 'browsing') {
    return updateSession(session.id, businessId, { phase: 'ordering' });
  }

  if (intent === 'greeting' && session.phase === 'confirmed') {
    return updateSession(session.id, businessId, { phase: 'browsing' });
  }

  return session;
}

async function runPreActions(
  session: SessionSnapshot,
  businessId: string,
  lastUserMessage: string,
  chatMessages: { role: string; content: string }[],
  routed: RoutedIntent
): Promise<{ session: SessionSnapshot; preloadedCart?: Record<string, unknown> }> {
  let current = session;
  let preloadedCart: Record<string, unknown> | undefined;

  const phone = extractPhoneNumber(lastUserMessage);
  if (phone) {
    const result = await executeAgentTool('set_delivery_info', { phone }, {
      businessId,
      session: current,
      chatMessages,
    });
    current = result.session;
    console.log('[Orchestrator] pre-action: saved phone');
  }

  const addressLike = lastUserMessage.length > 10
    && /\b(street|st\.|poxoc|փող|ul\.|улиц|taracq|թաղ|building|dom|bnak|shuka|prospect|avenue|ave)\b/i.test(lastUserMessage);
  if (addressLike && routed.intent === 'delivery_info') {
    const result = await executeAgentTool('set_delivery_info', { address: lastUserMessage.trim() }, {
      businessId,
      session: current,
      chatMessages,
    });
    current = result.session;
    console.log('[Orchestrator] pre-action: saved address');
  }

  if (routed.intent === 'view_cart' || routed.intent === 'checkout' || routed.intent === 'confirm') {
    const result = await executeAgentTool('get_cart', {}, {
      businessId,
      session: current,
      chatMessages,
    });
    current = result.session;
    preloadedCart = result.output.cart as Record<string, unknown>;
    console.log('[Orchestrator] pre-action: preloaded cart');
  }

  return { session: current, preloadedCart };
}

/**
 * Unified agent entry — intent routing, pre-actions, phase-aware tools, then LLM loop.
 */
export async function handleAgentMessage(
  params: HandleAgentMessageParams
): Promise<AgentTurnResult & { routed: RoutedIntent }> {
  const {
    businessId,
    businessName,
    customPrompt,
    session: initialSession,
    chatMessages,
    lastUserMessage,
    channel,
  } = params;

  const routed = routeIntent(lastUserMessage, initialSession, chatMessages);
  let session = await applyPhaseTransition(initialSession, businessId, routed.intent);
  const allowedTools = getAllowedTools(session.phase, routed.intent);

  console.log(`[Orchestrator] channel=${channel} intent=${routed.intent} phase=${session.phase} tools=${allowedTools.join(',')}`);

  const pre = await runPreActions(session, businessId, lastUserMessage, chatMessages, routed);
  session = pre.session;

  const orchestrationHint = formatOrchestrationBlock(
    {
      routed,
      allowedTools,
      orchestrationHint: '',
      preloadedCart: pre.preloadedCart,
    },
    session
  );

  const result = await runAgentTurn(
    buildOrchestratedTurnParams(params, routed, session, allowedTools, orchestrationHint)
  );

  let finalSession = result.session;

  if (result.orderReady) {
    finalSession = await resetSessionAfterOrder(session.id, businessId);
  }

  return {
    ...result,
    session: finalSession,
    routed,
  };
}

function buildOrchestratedTurnParams(
  params: HandleAgentMessageParams,
  routed: RoutedIntent,
  session: SessionSnapshot,
  allowedTools: ReturnType<typeof getAllowedTools>,
  orchestrationHint: string
): RunAgentTurnParams {
  return {
    businessId: params.businessId,
    businessName: params.businessName,
    customPrompt: params.customPrompt,
    session,
    chatMessages: params.chatMessages,
    lastUserMessage: params.lastUserMessage,
    forceFullMenu: routed.forceFullMenu,
    allowedTools,
    orchestrationHint,
  };
}

/** Web chat — stream final reply after orchestration + tools. */
export async function handleAgentMessageStream(
  params: HandleAgentMessageParams
): Promise<AgentOrchestratedStreamResult> {
  const {
    businessId,
    session: initialSession,
    chatMessages,
    lastUserMessage,
    channel,
  } = params;

  const routed = routeIntent(lastUserMessage, initialSession, chatMessages);
  let session = await applyPhaseTransition(initialSession, businessId, routed.intent);
  const allowedTools = getAllowedTools(session.phase, routed.intent);

  console.log(`[Orchestrator] channel=${channel} intent=${routed.intent} phase=${session.phase} tools=${allowedTools.join(',')}`);

  const pre = await runPreActions(session, businessId, lastUserMessage, chatMessages, routed);
  session = pre.session;

  const orchestrationHint = formatOrchestrationBlock(
    { routed, allowedTools, orchestrationHint: '', preloadedCart: pre.preloadedCart },
    session
  );

  const turnParams = buildOrchestratedTurnParams(params, routed, session, allowedTools, orchestrationHint);
  const { stream, completed } = await runAgentTurnStreaming(turnParams);

  const wrappedCompleted = completed.then(async (result) => {
    let finalSession = result.session;
    if (result.orderReady) {
      finalSession = await resetSessionAfterOrder(session.id, businessId);
    }
    return { ...result, session: finalSession, routed };
  });

  return {
    stream,
    completed: wrappedCompleted,
    routed,
    sessionId: session.id,
  };
}
