import { openai, buildSystemPrompt, type ExtractedOrder } from '@/lib/openai';
import { getMenuContext } from '@/lib/rag';
import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';
import { AGENT_TOOLS, parseToolArgs, filterTools, type AgentToolName } from './tools';
import { executeAgentTool } from './tool-executor';
import { formatSessionContext, type SessionSnapshot } from './session';
import type { MenuContextResult } from './types';

const MAX_TOOL_ROUNDS = 6;

export interface AgentTurnResult {
  reply: string;
  session: SessionSnapshot;
  menuContext: MenuContextResult;
  orderReady: ExtractedOrder | null;
}

export interface RunAgentTurnParams {
  businessId: string;
  businessName: string;
  customPrompt?: string | null;
  session: SessionSnapshot;
  chatMessages: { role: 'user' | 'assistant'; content: string }[];
  lastUserMessage: string;
  forceFullMenu?: boolean;
  allowedTools?: AgentToolName[];
  orchestrationHint?: string;
}

export interface AgentTurnStreamResult {
  stream: ReadableStream<Uint8Array>;
  completed: Promise<AgentTurnResult>;
}

function freshSystemMessage(
  businessName: string,
  customPrompt: string | null | undefined,
  menuContext: MenuContextResult,
  session: SessionSnapshot,
  orchestrationHint?: string
): ChatCompletionMessageParam {
  const base = buildSystemPrompt(
    businessName,
    menuContext.contextText,
    customPrompt,
    menuContext.scope,
    formatSessionContext(session),
    true,
    session.orderType
  );

  return {
    role: 'system',
    content: orchestrationHint ? `${base}\n\n${orchestrationHint}` : base,
  };
}

type ToolCallAcc = {
  id: string;
  name: string;
  arguments: string;
};

/** Accumulate streamed tool_call deltas into complete calls. */
function accumulateToolCalls(
  acc: Map<number, ToolCallAcc>,
  deltas: ChatCompletionChunk.Choice.Delta.ToolCall[] | undefined
) {
  if (!deltas) return;
  for (const tc of deltas) {
    const idx = tc.index ?? 0;
    const existing = acc.get(idx) ?? { id: '', name: '', arguments: '' };
    if (tc.id) existing.id = tc.id;
    if (tc.function?.name) existing.name += tc.function.name;
    if (tc.function?.arguments) existing.arguments += tc.function.arguments;
    acc.set(idx, existing);
  }
}

/**
 * Stream the agent turn as plain UTF-8 text (for useChat streamProtocol: 'text').
 * Tool rounds stay internal; only the final spoken reply is forwarded to the client.
 */
export async function runAgentTurnStreaming(
  params: RunAgentTurnParams
): Promise<AgentTurnStreamResult> {
  const {
    businessId,
    businessName,
    customPrompt,
    session: initialSession,
    chatMessages,
    lastUserMessage,
    forceFullMenu,
    allowedTools,
    orchestrationHint,
  } = params;

  let resolveCompleted!: (result: AgentTurnResult) => void;
  const completed = new Promise<AgentTurnResult>((resolve) => {
    resolveCompleted = resolve;
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let session = initialSession;
      let orderReady: ExtractedOrder | null = null;
      let menuContext: MenuContextResult = {
        products: [],
        contextText: '',
        scope: 'empty',
        directMatchIds: [],
      };
      let reply = '';

      try {
        const tools = filterTools(
          allowedTools ?? AGENT_TOOLS.map(t => t.function.name as AgentToolName)
        );

        menuContext = await getMenuContext(lastUserMessage, businessId, {
          forceFullMenu: forceFullMenu === true,
          messages: chatMessages,
        });

        const llmMessages: ChatCompletionMessageParam[] = [
          freshSystemMessage(businessName, customPrompt, menuContext, session, orchestrationHint),
          ...chatMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          llmMessages[0] = freshSystemMessage(
            businessName,
            customPrompt,
            menuContext,
            session,
            orchestrationHint
          );

          console.log(`[Agent] stream round ${round + 1} tools=${tools.map(t => t.function.name).join(',')}`);

          const oaiStream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            max_tokens: 1024,
            stream: true,
            tools,
            tool_choice: 'auto',
            messages: llmMessages,
          });

          const toolAcc = new Map<number, ToolCallAcc>();
          let textThisRound = '';

          for await (const chunk of oaiStream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            accumulateToolCalls(toolAcc, delta.tool_calls);

            // Only forward spoken tokens when this round is not a tool call.
            // (If tool_calls appear later in the stream, we will discard forwarded text —
            // rare with OpenAI; tool_calls usually arrive without user-facing content.)
            if (delta.content) {
              textThisRound += delta.content;
              if (toolAcc.size === 0) {
                reply += delta.content;
                controller.enqueue(encoder.encode(delta.content));
              }
            }
          }

          if (toolAcc.size > 0) {
            // Tool round — do not keep any speculative text in the client reply.
            if (textThisRound && reply.endsWith(textThisRound)) {
              // Shouldn't happen if we gated on toolAcc.size === 0, but be safe.
              reply = reply.slice(0, -textThisRound.length);
            }

            const toolCalls = Array.from(toolAcc.entries())
              .sort(([a], [b]) => a - b)
              .map(([, call]) => ({
                id: call.id,
                type: 'function' as const,
                function: { name: call.name, arguments: call.arguments },
              }));

            llmMessages.push({
              role: 'assistant',
              content: textThisRound || null,
              tool_calls: toolCalls,
            });

            for (const call of toolCalls) {
              const toolName = call.function.name as AgentToolName;
              const args = parseToolArgs(call.function.arguments);
              const result = await executeAgentTool(toolName, args, {
                businessId,
                session,
                chatMessages,
              });
              session = result.session;
              if (result.orderReady) orderReady = result.orderReady;

              llmMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result.output),
              });
            }
            continue;
          }

          // Spoken reply finished this round.
          if (!reply.trim()) {
            reply = textThisRound.trim()
              || 'Sorry, I had trouble processing that. Could you try again?';
            if (!textThisRound.trim()) {
              controller.enqueue(encoder.encode(reply));
            }
          }

          console.log('[Agent] streamed reply length:', reply.length, 'orderReady:', !!orderReady);
          controller.close();
          resolveCompleted({
            reply: reply.trim(),
            session,
            menuContext,
            orderReady,
          });
          return;
        }

        // Exhausted tool rounds without a spoken reply.
        const fallback = reply.trim()
          || 'Sorry, I had trouble processing that. Could you try again?';
        if (!reply.trim()) controller.enqueue(encoder.encode(fallback));
        controller.close();
        resolveCompleted({ reply: fallback, session, menuContext, orderReady });
      } catch (error) {
        console.error('[Agent] stream error:', error);
        const fallback = 'Sorry, something went wrong. Please try again.';
        try {
          if (!reply) controller.enqueue(encoder.encode(fallback));
          controller.close();
        } catch {
          // stream already closed
        }
        resolveCompleted({
          reply: reply.trim() || fallback,
          session,
          menuContext,
          orderReady: null,
        });
      }
    },
  });

  return { stream, completed };
}

/** Non-streaming path (Telegram, tests). */
export async function runAgentTurn(params: RunAgentTurnParams): Promise<AgentTurnResult> {
  const { stream, completed } = await runAgentTurnStreaming(params);
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
  return completed;
}
