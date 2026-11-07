import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { renderMarkdownSafe, summarizeChange } from './chatLogic';
import './chat.css';

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
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const next = [...prev];
      while (next.length < messages.length) {
        next.push(timeStr);
      }
      return next;
    });
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Auto-growing textarea (1 to 6 rows)
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate scrollHeight cleanly
    textarea.style.height = 'auto';

    // Calculate line height or row height bounds
    // Line height is ~20px, padding is ~19px total
    const computed = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computed.lineHeight) || 20;
    const paddingTop = parseFloat(computed.paddingTop) || 9;
    const paddingBottom = parseFloat(computed.paddingBottom) || 9;
    const padding = paddingTop + paddingBottom;

    const minHeight = lineHeight * 1 + padding;
    const maxHeight = lineHeight * 6 + padding;

    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [input]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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

  // Find index of the latest assistant message to attach lastChange summary
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  // Summary computed from lastChange if available
  const summaryText = lastChange
    ? summarizeChange(lastChange.changedIds || lastChange.changed, lastChange.map)
    : null;

  return (
    <div className="mc-chat-container">
      <div className="mc-chat-header">
        <div className="mc-chat-title-group">
          <h2>Chat</h2>
          <span className="mc-chat-subtitle">Describe your app idea</span>
        </div>
      </div>

      <div className="mc-chat-messages">
        {messages.length === 0 ? (
          <div className="mc-chat-empty-state">
            <span className="mc-empty-badge">Welcome to MindCode</span>
            <div className="mc-empty-headline">
              Describe the app you want. I&apos;ll map every assumption I make.
            </div>

            <span className="mc-empty-chips-label">Try an example</span>
            <div className="mc-empty-chips">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="mc-prompt-chip"
                  onClick={() => handleChipClick(prompt)}
                  disabled={loading}
                >
                  <span>{prompt}</span>
                  <span className="mc-chip-arrow">&rarr;</span>
                </button>
              ))}
            </div>

            <div className="mc-chat-color-key" aria-label="Bubble color key">
              <span className="mc-key-item">
                <span className="mc-key-dot user orange" /> orange = you said it
              </span>
              <span className="mc-key-item">
                <span className="mc-key-dot inferred green" /> green = Claude assumed
              </span>
              <span className="mc-key-item">
                <span className="mc-key-dot unknown red" /> red = open question
              </span>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const timestamp = timestamps[index] || '';
            const isLatestAssistant = index === lastAssistantIndex;

            return (
              <div
                key={index}
                className={`mc-message-wrapper ${isUser ? 'mc-message-user' : 'mc-message-assistant'}`}
              >
                <div className="mc-message-header">
                  <span className="mc-role-name">{isUser ? 'You' : 'Claude'}</span>
                  {timestamp && <span className="mc-timestamp">{timestamp}</span>}
                </div>

                {isUser ? (
                  <div className="mc-bubble-content">{msg.text}</div>
                ) : (
                  <div
                    className="mc-bubble-content"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownSafe(msg.text),
                    }}
                  />
                )}

                {/* Inline summary row after Claude's reply when lastChange is passed */}
                {!isUser && isLatestAssistant && summaryText && (
                  <div className="mc-summary-row" title="Mind map changes in this turn">
                    <span className="mc-summary-icon">✨</span>
                    <span>{summaryText}</span>
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div className="mc-message-wrapper mc-message-assistant">
            <div className="mc-message-header">
              <span className="mc-role-name">Claude</span>
            </div>
            <div className="mc-typing-bubble" aria-label="Claude is typing">
              <span className="mc-typing-dot" />
              <span className="mc-typing-dot" />
              <span className="mc-typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="mc-chat-error">{error}</div>}

      <form className="mc-chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="mc-chat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your app... (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={loading}
        />
        <button
          type="submit"
          className="mc-chat-send-btn"
          disabled={loading || !input.trim()}
          title="Send message (Enter)"
        >
          Send
        </button>
      </form>
    </div>
  );
}
