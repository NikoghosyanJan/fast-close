'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect } from 'react';
import { Send, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  business: { id: string; name: string };
}

export default function ChatInterface({ business }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { businessId: business.id },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! 👋 I'm the AI assistant for **${business.name}**. How can I help you today?`,
      },
    ],
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-screen flex flex-col bg-[hsl(var(--chat-bg))]">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 shadow-sm z-10"
        style={{ background: 'hsl(var(--primary))' }}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
            {business.name}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
            <span className="text-white/80 text-xs">AI Assistant · Online</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const showTime = idx === messages.length - 1 || messages[idx + 1]?.role !== msg.role;

          return (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col gap-0.5 animate-fade-in',
                isUser ? 'items-end' : 'items-start'
              )}
            >
              <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                <MessageContent content={msg.content} />
              </div>
              {showTime && (
                <span className="text-[10px] text-muted-foreground px-1">
                  {formatTime(msg.createdAt ?? new Date())}
                </span>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start animate-fade-in">
            <div className="chat-bubble-ai flex items-center gap-1 py-3 px-4">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 bg-[hsl(var(--chat-bg))] border-t border-border/40">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-card rounded-2xl px-4 py-2.5 shadow-md border border-border/50"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message…"
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
              input.trim() && !isLoading
                ? 'bg-primary text-white shadow-md shadow-primary/30 hover:opacity-90'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Powered by <span className="font-semibold text-primary">FastClose AI</span>
        </p>
      </div>
    </div>
  );
}

// Render markdown-lite: bold and line breaks
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return (
          <span key={i}>
            {part.split('\n').map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}
