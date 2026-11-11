import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ArrowUp, Check, Copy } from 'lucide-react';
import { renderMarkdownSafe, summarizeChange } from './chatLogic';
import { cn } from '@/lib/utils';

// Chat pane, styled after Claude's chat: the user's turns are quiet pills on the right,
// Claude's replies are unboxed serif prose, and a single rounded composer sits at the bottom.

const EXAMPLE_PROMPTS = [
  'A chat app for my study group',
  'A habit tracker for my team',
  'A recipe box with a shopping list',
];

export default function Chat({
  messages = [],
  onSendMessage,
  loading = false,
  error = null,
  lastChange = null,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [timestamps, setTimestamps] = useState([]);

  // Keep a timestamp for each message
  useEffect(() => {
    setTimestamps((prev) => {
      if (prev.length === messages.length) return prev;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const next = [...prev];
      while (next.length < messages.length) next.push(timeStr);
      return next;
    });
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-growing textarea (1 to 6 rows)
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const computed = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computed.lineHeight) || 20;
    const padding = (parseFloat(computed.paddingTop) || 6) + (parseFloat(computed.paddingBottom) || 6);
    const newHeight = Math.min(Math.max(textarea.scrollHeight, lineHeight + padding), lineHeight * 6 + padding);
    textarea.style.height = `${newHeight}px`;
  }, [input]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChipClick = (promptText) => {
    if (loading) return;
    onSendMessage(promptText);
  };

  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  const summaryText = lastChange
    ? summarizeChange(lastChange.changedIds || lastChange.changed, lastChange.map)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Chat</h2>
        <span className="text-[11px] text-dim">Claude Opus</span>
      </div>

      <div className="mc-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col gap-6 pt-6">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-dim">MindCode</p>
              <h3 className="font-serif text-[22px] font-normal leading-snug text-foreground">
                Describe the app you want. I&apos;ll map every assumption I make.
              </h3>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Try an example</p>
              <div className="flex flex-col gap-1.5">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleChipClick(prompt)}
                    disabled={loading}
                    className="group flex w-full cursor-pointer items-center justify-between rounded-lg border border-hairline bg-transparent px-3 py-2.5 text-left font-sans text-[13.5px] text-foreground transition-colors hover:border-user/50 hover:bg-raised disabled:opacity-50"
                  >
                    <span>{prompt}</span>
                    <span className="text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-user">
                      &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Bubble color key">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-user" /> you said it
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-ai" /> Claude assumed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-unknown" /> open question
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const timestamp = timestamps[index] || '';
              const isLatestAssistant = index === lastAssistantIndex;

              if (isUser) {
                return (
                  <div key={index} className="group flex flex-col items-end gap-1">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-raised px-4 py-2.5 text-[14px] leading-relaxed text-foreground">
                      {msg.text}
                    </div>
                    {timestamp && (
                      <span className="text-[10.5px] text-dim opacity-0 transition-opacity group-hover:opacity-100">
                        {timestamp}
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <div key={index} className="group flex flex-col gap-2">
                  <div
                    className={cn(
                      'font-serif text-[15.5px] leading-[1.65] text-foreground',
                      '[&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1 [&_p]:my-2',
                    )}
                    dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(msg.text) }}
                  />
                  {isLatestAssistant && summaryText && (
                    <div className="flex items-center gap-1.5 text-xs text-ai" title="Mind map changes in this turn">
                      <span className="size-1.5 rounded-full bg-ai" />
                      <span>{summaryText}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-dim">
                    <CopyButton text={msg.text} />
                    {timestamp && (
                      <span className="ml-1 text-[10.5px] opacity-0 transition-opacity group-hover:opacity-100">
                        {timestamp}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-1.5 py-1" aria-label="Claude is thinking" role="status" aria-live="polite">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-ai/80"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">Claude is mapping everything it would build… (about 30–60 s)</span>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mc-scroll mx-4 mb-2 max-h-24 overflow-y-auto break-words rounded-md border border-unknown/40 bg-unknown/10 px-3 py-2 text-xs text-red-300 [overflow-wrap:anywhere]">
          {error}
        </div>
      )}

      <form className="shrink-0 px-4 pb-3" onSubmit={handleSubmit}>
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-raised px-3 py-2 transition-colors focus-within:border-ai/50">
          <textarea
            ref={textareaRef}
            className="min-h-[24px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 font-sans text-[14px] leading-5 text-foreground outline-none placeholder:text-dim"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.length ? 'Reply…' : 'Describe your app…'}
            rows={1}
            disabled={loading}
            aria-label="Message Claude"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            title="Send (Enter)"
            aria-label="Send message"
            className="mb-0.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-ai text-[#0b1a14] transition hover:brightness-110 disabled:cursor-default disabled:bg-accent disabled:text-dim"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-dim">
          <span>Shift+Enter for a new line</span>
          <span className="hidden xl:inline">Check the bubbles before you build</span>
        </div>
      </form>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      aria-label="Copy reply"
      className="flex size-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-dim transition-colors hover:bg-accent hover:text-foreground"
      onClick={() => {
        try {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}
