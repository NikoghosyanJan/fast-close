import { openai, buildSystemPrompt, type ExtractedOrder } from '@/lib/openai';
import { getMenuContext } from '@/lib/rag';
import { OpenAIStream } from 'ai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
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
    true
  );

  return {
    role: 'system',
    content: orchestrationHint ? `${base}\n\n${orchestrationHint}` : base,
  };
}

interface ToolLoopState {
  llmMessages: ChatCompletionMessageParam[];
  session: SessionSnapshot;
  orderReady: ExtractedOrder | null;
  menuContext: MenuContextResult;
  fallbackReply?: string;
}

async function runToolLoop(params: RunAgentTurnParams): Promise<ToolLoopState> {
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

  let session = initialSession;
  let orderReady: ExtractedOrder | null = null;

  const tools = filterTools(allowedTools ?? AGENT_TOOLS.map(t => t.function.name as AgentToolName));

  const menuContext = await getMenuContext(lastUserMessage, businessId, {
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
    llmMessages[0] = freshSystemMessage(businessName, customPrompt, menuContext, session, orchestrationHint);

    console.log(`[Agent] round ${round + 1} tools=${tools.map(t => t.function.name).join(',')}`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1024,
      tools,
      tool_choice: 'auto',
      messages: llmMessages,
    });

    const choice = completion.choices[0]?.message;
    if (!choice) break;

    if (choice.tool_calls?.length) {
      llmMessages.push({
        role: 'assistant',
        content: choice.content ?? '',
        tool_calls: choice.tool_calls,
      });

      for (const call of choice.tool_calls) {
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

    // Model returned text without tools — use as fallback if streaming fails
    if (choice.content?.trim()) {
      return {
        llmMessages,
        session,
        orderReady,
        menuContext,
        fallbackReply: choice.content.trim(),
      };
    }
    break;
  }

  return { llmMessages, session, orderReady, menuContext };
}

/** Pipe Vercel AI SDK OpenAIStream into a plain-text byte stream for useChat (streamProtocol: 'text'). */
async function pipeOpenAIStream(
  sdkStream: ReadableStream,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
): Promise<void> {
  const reader = sdkStream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
    if (text) controller.enqueue(encoder.encode(text));
  }
  controller.close();
}

/**
 * Run tool rounds inside the stream, then stream the final reply token-by-token.
 * Returns immediately so the HTTP response can start before tools finish.
 */
export async function runAgentTurnStreaming(
  params: RunAgentTurnParams
): Promise<AgentTurnStreamResult> {
  const {
    businessName,
    customPrompt,
    orchestrationHint,
  } = params;

  let resolveCompleted!: (result: AgentTurnResult) => void;
  const completed = new Promise<AgentTurnResult>((resolve) => {
    resolveCompleted = resolve;
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const loop = await runToolLoop(params);
        let { llmMessages, session, orderReady, menuContext, fallbackReply } = loop;

        llmMessages[0] = freshSystemMessage(
          businessName,
          customPrompt,
          menuContext,
          session,
          orchestrationHint
        );

        if (fallbackReply) {
          const sdkStream = OpenAIStream(
            (async function* () {
              yield { choices: [{ delta: { content: fallbackReply } }] } as never;
            })(),
            {
              onFinal: (completion) => {
                resolveCompleted({ reply: completion, session, menuContext, orderReady });
              },
            }
          );
          await pipeOpenAIStream(sdkStream, controller, encoder);
          return;
        }

        console.log('[Agent] streaming final reply (OpenAIStream)');

        const oaiStream = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 1024,
          stream: true,
          tool_choice: 'none',
          messages: llmMessages,
        });

        const sdkStream = OpenAIStream(
          oaiStream as unknown as Parameters<typeof OpenAIStream>[0],
          {
          onFinal: (completion) => {
            const reply = completion.trim()
              || 'Sorry, I had trouble processing that. Could you try again?';
            console.log('[Agent] streamed reply length:', reply.length, 'orderReady:', !!orderReady);
            resolveCompleted({ reply, session, menuContext, orderReady });
          },
        });

        await pipeOpenAIStream(sdkStream, controller, encoder);
      } catch (error) {
        console.error('[Agent] stream error:', error);
        const fallback = 'Sorry, something went wrong. Please try again.';
        try {
          controller.enqueue(encoder.encode(fallback));
          controller.close();
        } catch {
          // stream already closed
        }
        resolveCompleted({
          reply: fallback,
          session: params.session,
          menuContext: { products: [], contextText: '', scope: 'empty', directMatchIds: [] },
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
  const decoder = new TextDecoder();
  let reply = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    reply += decoder.decode(value, { stream: true });
  }
  return completed;
}
