import React, { useState, useRef, useEffect } from 'react';

export default function Chat({ messages = [], onSendMessage, loading = false, error = null }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-container">
      <div className="pane-header">
        <h2>Chat</h2>
        <span className="pane-subtitle">Describe your app idea</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>Start by describing the web app you want to build.</p>
            <p className="chat-hint">Example: &ldquo;I want a chat app for my study group&rdquo;</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-bubble-wrapper chat-bubble-${msg.role}`}
            >
              <div className="chat-role-label">
                {msg.role === 'user' ? 'You' : 'Claude'}
              </div>
              <div className="chat-bubble-text">{msg.text}</div>
            </div>
          ))
        )}
        {loading && (
          <div className="chat-bubble-wrapper chat-bubble-assistant">
            <div className="chat-role-label">Claude</div>
            <div className="chat-bubble-text chat-loading">
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Claude... (Enter to send)"
          rows={2}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
