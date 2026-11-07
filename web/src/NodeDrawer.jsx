import React, { useState, useEffect, useRef } from 'react';
import * as api from './api';
import {
  sourceBadge,
  canApprove,
  nextLockStatus,
  canChat,
  normalizeInventiveness,
} from './nodeDrawerLogic';
import './drawer.css';

/**
 * NodeDrawer component
 *
 * Props:
 * - sessionId: string
 * - node: Node | null
 * - onNodeChange: (node: Node) => void
 * - onClose: () => void
 * - onError: (msg: string) => void
 */
export default function NodeDrawer({
  sessionId,
  node,
  onNodeChange = () => {},
  onClose = () => {},
  onError = () => {},
}) {
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Reset mini-chat when opening or switching to a different node
  const currentNodeId = node?.id;
  useEffect(() => {
    setMessages([]);
    setChatInput('');
    setChatLoading(false);
    setActionLoading(false);
  }, [currentNodeId]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && node) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [node, onClose]);

  // Scroll mini chat to bottom on new messages or typing indicator
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  if (!node) {
    return null;
  }

  const badge = sourceBadge(node);
  const isApproved = node.status === 'approved';
  const isLocked = node.status === 'locked';
  const chatAllowed = canChat(node);
  const approveAllowed = canApprove(node);
  const inventivenessVal = normalizeInventiveness(node.inventiveness);

  const handleApprove = async () => {
    if (!approveAllowed || actionLoading) return;
    setActionLoading(true);
    try {
      const updatedNode = await api.approveNode(sessionId, node.id);
      onNodeChange(updatedNode);
    } catch (err) {
      onError(err?.message || 'Failed to approve node');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const targetStatus = nextLockStatus(node);
    try {
      const updatedNode = await api.patchNode(sessionId, node.id, {
        status: targetStatus,
      });
      onNodeChange(updatedNode);
    } catch (err) {
      onError(err?.message || 'Failed to update lock status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading || !chatAllowed) return;

    // Optimistically show user message
    const optimisticUserMsg = { role: 'user', text };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.chatNode(sessionId, node.id, text);
      if (res) {
        if (Array.isArray(res.history) && res.history.length > 0) {
          setMessages(res.history);
        } else if (res.reply) {
          setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
        }

        if (res.node) {
          onNodeChange(res.node);
        }
      }
    } catch (err) {
      onError(err?.message || 'Failed to send message to Claude');
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Importance 1-5 dots
  const importance = Math.max(1, Math.min(5, parseInt(node.importance, 10) || 1));

  return (
    <aside className="node-drawer open" aria-label="Node detail drawer">
      {/* Header */}
      <div className="drawer-header">
        <div className="drawer-header-top">
          <h2 className="drawer-title">{node.label}</h2>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
            title="Close (Escape)"
          >
            ×
          </button>
        </div>

        <div className="drawer-meta-row">
          {node.kind && <span className="badge-kind">{node.kind}</span>}
          <span className={`badge-source ${badge.className}`}>{badge.label}</span>
        </div>

        {/* Inferred inventiveness bar */}
        {node.source === 'inferred' && (
          <div className="inventiveness-section">
            <div className="inventiveness-label-row">
              <span>obvious</span>
              <span>inventiveness: {Math.round(inventivenessVal * 100)}%</span>
              <span>creative leap</span>
            </div>
            <div className="inventiveness-bar-bg">
              <div
                className="inventiveness-bar-fill"
                style={{ width: `${inventivenessVal * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="drawer-actions">
        <button
          type="button"
          className="btn-approve"
          onClick={handleApprove}
          disabled={!approveAllowed || actionLoading}
          title={
            isApproved
              ? 'Already approved'
              : isLocked
              ? 'Unlock to approve'
              : 'Approve this bubble'
          }
        >
          ✓ {isApproved ? 'Approved' : 'Approve'}
        </button>

        <button
          type="button"
          className="btn-lock"
          onClick={handleToggleLock}
          disabled={actionLoading}
          title={isLocked ? 'Unlock bubble' : 'Lock bubble'}
        >
          {isLocked ? '🔓 Unlock' : '🔒 Lock'}
        </button>
      </div>

      {/* Body: Detail, Evidence, Importance */}
      <div className="drawer-body">
        {node.detail && <p className="drawer-detail">{node.detail}</p>}

        {Array.isArray(node.evidence) && node.evidence.length > 0 && (
          <div className="drawer-evidence">
            <div className="drawer-evidence-title">Evidence</div>
            <ul className="drawer-evidence-quotes">
              {node.evidence.map((quote, idx) => (
                <li key={idx}>&ldquo;{quote}&rdquo;</li>
              ))}
            </ul>
          </div>
        )}

        <div className="drawer-importance">
          <span>Importance:</span>
          <div className="importance-dots" aria-label={`Importance ${importance} of 5`}>
            {[1, 2, 3, 4, 5].map((dot) => (
              <span
                key={dot}
                className={`importance-dot ${dot <= importance ? 'active' : ''}`}
              />
            ))}
          </div>
          <span>({importance}/5)</span>
        </div>
      </div>

      {/* Mini Chat */}
      <div className="drawer-chat">
        <div className="drawer-chat-title">Brainstorm with Claude</div>

        <div className="drawer-chat-messages">
          {messages.length === 0 ? (
            <div className="drawer-chat-empty">
              Discuss this bubble with Claude to refine its scope or wording.
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`drawer-chat-bubble drawer-chat-bubble-${msg.role}`}
              >
                <div className="drawer-chat-role">
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div className="drawer-chat-text">{msg.text}</div>
              </div>
            ))
          )}

          {chatLoading && (
            <div className="drawer-chat-bubble drawer-chat-bubble-assistant">
              <div className="drawer-chat-role">Claude</div>
              <div className="drawer-chat-text drawer-typing-indicator">
                <span className="drawer-typing-dot" />
                <span className="drawer-typing-dot" />
                <span className="drawer-typing-dot" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <form className="drawer-chat-form" onSubmit={handleSendMessage}>
          {isLocked && (
            <div className="drawer-locked-hint">
              <span>🔒</span> Unlock to change this bubble
            </div>
          )}
          <div className="drawer-chat-input-row">
            <textarea
              className="drawer-chat-textarea"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder={
                isLocked
                  ? 'Bubble is locked'
                  : 'Message Claude about this bubble... (Enter to send)'
              }
              rows={2}
              disabled={!chatAllowed || chatLoading}
            />
            <button
              type="submit"
              className="drawer-chat-send-btn"
              disabled={!chatAllowed || chatLoading || !chatInput.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
