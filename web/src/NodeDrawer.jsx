import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, Check, Link2, Lock, Pencil, Plus, Trash2, Unlock, X } from 'lucide-react';
import * as api from './api';
import { canApprove, nextLockStatus, canChat, normalizeInventiveness } from './nodeDrawerLogic';
import { formatApiError, formatCooldown } from './chatLogic';
import { cn } from '@/lib/utils';
import { ancestorsOf } from './treeLayout';
import { Button } from '@/ui/primitives/button';
import { Badge } from '@/ui/primitives/badge';
import { Separator } from '@/ui/primitives/separator';

/**
 * NodeDrawer: an Obsidian-style right rail over the map for one bubble. You can discuss the
 * bubble with Claude, then Approve or Lock it.
 *
 * Props:
 * - sessionId: string
 * - node: Node | null
 * - onNodeChange: (node: Node) => void
 * - onClose: () => void
 * - onError: (msg: string) => void
 */

const SOURCE_STYLE = {
  user: { label: 'You said it', dot: 'bg-user', chip: 'border-user/50 text-user' },
  inferred: { label: 'Claude assumed', dot: 'bg-ai', chip: 'border-ai/50 text-ai' },
  unknown: { label: 'Open question', dot: 'bg-unknown', chip: 'border-unknown/50 text-red-300' },
};

function SectionLabel({ children }) {
  return <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">{children}</p>;
}

export default function NodeDrawer({
  sessionId,
  node,
  onNodeChange = () => {},
  onClose = () => {},
  onError = () => {},
  map = { nodes: [], edges: [] },
  onMapChange = async () => {},
}) {
  const [messages, setMessages] = useState([]);
  // Inline editing of the bubble's own text
  const [editing, setEditing] = useState(null); // 'label' | 'detail' | null
  const [draft, setDraft] = useState('');
  // Add child / connect
  const [panel, setPanel] = useState(null); // 'child' | 'connect' | null
  const [childLabel, setChildLabel] = useState('');
  const [connectTo, setConnectTo] = useState('');
  const [relation, setRelation] = useState('informs');
  const [suggestions, setSuggestions] = useState([]); // Claude's suggested sub-bubbles from the brainstorm
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef(null);
  const chatEndRef = useRef(null);

  // Reset the mini chat when opening or switching to a different node
  const currentNodeId = node?.id;
  useEffect(() => {
    setMessages([]);
    setChatInput('');
    setChatLoading(false);
    setActionLoading(false);
    setEditing(null);
    setPanel(null);
    setChildLabel('');
    setConnectTo('');
    setSuggestions([]);
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setCooldownSeconds(0);
  }, [currentNodeId]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = (seconds) => {
    let remaining = seconds || 5;
    setCooldownSeconds(remaining);
    onError(formatCooldown(remaining));
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
        setCooldownSeconds(0);
      } else {
        setCooldownSeconds(remaining);
        onError(formatCooldown(remaining));
      }
    }, 1000);
  };

  // Escape closes the drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && node) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [node, onClose]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  if (!node) return null;

  const isApproved = node.status === 'approved';
  const isLocked = node.status === 'locked';
  const chatAllowed = canChat(node);
  const approveAllowed = canApprove(node);
  const inventivenessVal = normalizeInventiveness(node.inventiveness);
  const source = SOURCE_STYLE[node.source] || SOURCE_STYLE.unknown;
  const importance = Math.max(1, Math.min(5, parseInt(node.importance, 10) || 1));
  const evidence = Array.isArray(node.evidence) ? node.evidence : [];

  const handleApprove = async () => {
    if (!approveAllowed || actionLoading) return;
    setActionLoading(true);
    try {
      onNodeChange(await api.approveNode(sessionId, node.id));
    } catch (err) {
      onError(formatApiError(err) || 'Failed to approve node');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      onNodeChange(await api.patchNode(sessionId, node.id, { status: nextLockStatus(node) }));
    } catch (err) {
      onError(formatApiError(err) || 'Failed to update lock status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading || !chatAllowed || cooldownSeconds > 0) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await api.chatNode(sessionId, node.id, text);
      if (res) {
        if (Array.isArray(res.history) && res.history.length > 0) setMessages(res.history);
        else if (res.reply) setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
        if (res.node) onNodeChange(res.node);
        setSuggestions(Array.isArray(res.suggest) ? res.suggest : []);
      }
    } catch (err) {
      if (err.status === 429) {
        startCooldown(err.retry_after_s || 5);
      } else {
        onError(formatApiError(err) || 'Failed to send message to Claude');
      }
    } finally {
      setChatLoading(false);
    }
  };

  const startEdit = (field) => {
    if (isLocked) return;
    setEditing(field);
    setDraft(field === 'label' ? node.label : node.detail || '');
  };

  const saveEdit = async () => {
    const field = editing;
    const value = draft.trim();
    setEditing(null);
    const current = field === 'label' ? node.label : node.detail || '';
    if (!field || (field === 'label' && !value) || value === current) return;
    try {
      onNodeChange(await api.patchNode(sessionId, node.id, { [field]: value }));
    } catch (err) {
      if (err.status === 429) {
        startCooldown(err.retry_after_s || 5);
      } else {
        onError(formatApiError(err) || 'Failed to save the bubble');
      }
    }
  };

  const editKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setEditing(null);
    }
    if (e.key === 'Enter' && (editing === 'label' || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveEdit();
    }
  };

  const handleAddChild = async (e) => {
    e?.preventDefault();
    const label = childLabel.trim();
    if (!label || actionLoading || cooldownSeconds > 0) return;
    setActionLoading(true);
    try {
      const created = await api.createNode(sessionId, { label, parent: node.id, kind: 'feature' });
      setChildLabel('');
      setPanel(null);
      await onMapChange(created?.id);
    } catch (err) {
      if (err.status === 429) {
        startCooldown(err.retry_after_s || 5);
      } else {
        onError(formatApiError(err) || 'Failed to add the bubble');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async (e) => {
    e?.preventDefault();
    if (!connectTo || actionLoading) return;
    setActionLoading(true);
    try {
      await api.createEdge(sessionId, { from: node.id, to: connectTo, relation });
      setConnectTo('');
      setPanel(null);
      await onMapChange();
    } catch (err) {
      onError(formatApiError(err) || 'Failed to connect the bubbles');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (actionLoading) return;
    if (!window.confirm(`Delete "${node.label}"? Its children move up to its parent.`)) return;
    setActionLoading(true);
    try {
      await api.deleteNode(sessionId, node.id);
      await onMapChange(null);
      onClose();
    } catch (err) {
      onError(formatApiError(err) || 'Failed to delete the bubble');
    } finally {
      setActionLoading(false);
    }
  };

  const otherNodes = (map.nodes || []).filter((n) => n.id !== node.id);
  const linked = (map.edges || []).filter((e) => e.from === node.id || e.to === node.id);
  const labelOf = (id) => (map.nodes || []).find((n) => n.id === id)?.label || '?';

  const addSuggestion = async (sg) => {
    if (actionLoading || cooldownSeconds > 0) return;
    setActionLoading(true);
    try {
      await api.createNode(sessionId, { label: sg.label, detail: sg.detail, kind: sg.kind || 'feature', parent: node.id });
      setSuggestions((prev) => prev.filter((x) => x !== sg));
      await onMapChange();
    } catch (err) {
      if (err.status === 429) {
        startCooldown(err.retry_after_s || 5);
      } else {
        onError(formatApiError(err) || 'Failed to add the suggested bubble');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <aside
      className="node-drawer absolute inset-y-0 right-0 z-20 flex w-[min(380px,92%)] flex-col border-l border-hairline bg-surface font-sans text-foreground shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.6)] animate-in"
      aria-label="Bubble details"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 px-5 pt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn('gap-1.5 bg-transparent', source.chip)}>
              <span className={cn('size-1.5 rounded-full', source.dot)} />
              {source.label}
            </Badge>
            {node.kind && (
              <Badge variant="outline" className="border-hairline bg-transparent text-[10.5px] uppercase tracking-wide text-muted-foreground">
                {node.kind}
              </Badge>
            )}
            {isApproved && (
              <Badge variant="outline" className="border-approved/60 bg-approved/10 text-approved">
                <Check /> Approved
              </Badge>
            )}
            {isLocked && (
              <Badge variant="outline" className="border-hairline text-muted-foreground">
                <Lock /> Locked
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <X />
          </Button>
        </div>

        {(() => {
          const path = ancestorsOf(map, node.id).slice(0, -1);
          if (!path.length) return null;
          const byId = new Map((map.nodes || []).map((n) => [n.id, n]));
          return (
            <nav aria-label="Path to this bubble" className="-mb-1 flex flex-wrap items-center gap-1 text-[11px] text-dim">
              {path.map((id) => (
                <span key={id} className="flex items-center gap-1">
                  <span className="max-w-[140px] truncate">{byId.get(id)?.label}</span>
                  <span aria-hidden>›</span>
                </span>
              ))}
            </nav>
          );
        })()}
        {editing === 'label' ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={editKeyDown}
            maxLength={80}
            aria-label="Bubble label"
            className="w-full rounded-md border border-ai/50 bg-raised px-2 py-1 font-sans text-[19px] font-semibold tracking-tight text-foreground outline-none"
          />
        ) : (
          <h2
            className={cn('group/title flex items-start gap-2 text-[19px] font-semibold leading-snug tracking-tight', !isLocked && 'cursor-text')}
            onClick={() => startEdit('label')}
            title={isLocked ? 'Unlock to edit' : 'Click to edit'}
          >
            <span>{node.label}</span>
            {!isLocked && <Pencil className="mt-1.5 size-3.5 shrink-0 text-dim opacity-0 transition-opacity group-hover/title:opacity-100" />}
          </h2>
        )}
        {editing === 'detail' ? (
          <textarea
            autoFocus
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={editKeyDown}
            aria-label="Bubble detail"
            placeholder="Describe this bubble (Ctrl+Enter to save)"
            className="w-full resize-none rounded-md border border-ai/50 bg-raised px-2 py-1.5 font-serif text-[14.5px] leading-relaxed text-foreground outline-none"
          />
        ) : (
          <p
            className={cn('font-serif text-[14.5px] leading-relaxed text-muted-foreground', !isLocked && 'cursor-text hover:text-foreground')}
            onClick={() => startEdit('detail')}
            title={isLocked ? 'Unlock to edit' : 'Click to edit'}
          >
            {node.detail || (isLocked ? '' : 'Add a description…')}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="approve"
            className="flex-1"
            onClick={handleApprove}
            disabled={!approveAllowed || actionLoading}
            title={isApproved ? 'Already approved' : isLocked ? 'Unlock to approve' : 'Approve this bubble'}
          >
            <Check /> {isApproved ? 'Approved' : 'Approve'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleToggleLock}
            disabled={actionLoading}
            title={isLocked ? 'Unlock bubble' : 'Lock: rebuilds keep this bubble’s code unchanged'}
          >
            {isLocked ? <Unlock /> : <Lock />} {isLocked ? 'Unlock' : 'Lock'}
          </Button>
        </div>

        {/* Shape the map yourself: add, connect, delete */}
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setPanel(panel === 'child' ? null : 'child')} title="Add a bubble under this one">
            <Plus /> Add child
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPanel(panel === 'connect' ? null : 'connect')} disabled={!otherNodes.length} title="Link this bubble to another">
            <Link2 /> Connect
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto hover:text-unknown" onClick={handleDelete} disabled={actionLoading} title="Delete this bubble" aria-label="Delete bubble">
            <Trash2 />
          </Button>
        </div>
        {panel === 'child' && (
          <form onSubmit={handleAddChild} className="flex gap-1.5">
            <input
              autoFocus
              value={childLabel}
              onChange={(e) => setChildLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setPanel(null)}
              maxLength={80}
              placeholder="New bubble, e.g. Dark mode"
              aria-label="New child bubble label"
              className="min-w-0 flex-1 rounded-md border border-input bg-raised px-2.5 py-1.5 font-sans text-[13px] text-foreground outline-none placeholder:text-dim focus:border-user/60"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!childLabel.trim() || actionLoading}>
              Add
            </Button>
          </form>
        )}
        {panel === 'connect' && (
          <form onSubmit={handleConnect} className="flex flex-wrap gap-1.5">
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              aria-label="Relation"
              className="rounded-md border border-input bg-raised px-2 py-1.5 font-sans text-[13px] text-foreground outline-none"
            >
              <option value="informs">informs</option>
              <option value="needs">needs</option>
              <option value="has">has</option>
            </select>
            <select
              autoFocus
              value={connectTo}
              onChange={(e) => setConnectTo(e.target.value)}
              aria-label="Connect to"
              className="min-w-0 flex-1 rounded-md border border-input bg-raised px-2 py-1.5 font-sans text-[13px] text-foreground outline-none"
            >
              <option value="">Choose a bubble…</option>
              {otherNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="secondary" disabled={!connectTo || actionLoading}>
              Link
            </Button>
          </form>
        )}
        {linked.length > 0 && (
          <p className="text-[11.5px] text-dim">
            Linked:{' '}
            {linked.slice(0, 6).map((e, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {e.from === node.id ? `${e.relation} → ${labelOf(e.to)}` : `${labelOf(e.from)} ${e.relation} →`}
              </span>
            ))}
            {linked.length > 6 && ` · +${linked.length - 6}`}
          </p>
        )}
      </div>

      <Separator className="bg-hairline" />

      {/* Why it's here: evidence (Obsidian "linked mentions" style) or how bold the assumption is */}
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-2">
          <SectionLabel>Why it&apos;s here</SectionLabel>
          {evidence.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {evidence.map((quote, idx) => (
                <li key={idx} className="rounded-md border-l-2 border-user bg-user/10 px-3 py-1.5 font-serif text-[13.5px] text-foreground">
                  &ldquo;{quote}&rdquo;
                </li>
              ))}
            </ul>
          ) : node.source === 'inferred' ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] text-muted-foreground">You never said this. Claude assumed it.</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full bg-ai" style={{ width: `${Math.max(6, inventivenessVal * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10.5px] text-dim">
                <span>obvious</span>
                <span>{Math.round(inventivenessVal * 100)}% inventive</span>
                <span>creative leap</span>
              </div>
            </div>
          ) : isApproved || isLocked ? (
            <p className="text-[13px] text-muted-foreground">You decided this with Claude.</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nobody decided this yet. Tell Claude below.</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <SectionLabel>Importance</SectionLabel>
          <div className="flex items-center gap-1" aria-label={`Importance ${importance} of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={cn('h-1.5 w-5 rounded-full', i <= importance ? 'bg-foreground/80' : 'bg-raised')} />
            ))}
          </div>
        </div>
      </div>

      <Separator className="bg-hairline" />

      {/* Brainstorm with Claude (same language as the main chat) */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-5 pt-4">
          <SectionLabel>Brainstorm with Claude</SectionLabel>
        </div>
        <div className="mc-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {messages.length === 0 ? (
            <p className="text-[13px] text-dim">Ask Claude to refine, rename or decide this bubble.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg, idx) =>
                msg.role === 'user' ? (
                  <div key={idx} className="ml-auto max-w-[85%] rounded-2xl bg-raised px-3 py-2 text-[13px]">
                    {msg.text}
                  </div>
                ) : (
                  <p key={idx} className="m-0 font-serif text-[14px] leading-relaxed text-foreground">
                    {msg.text}
                  </p>
                ),
              )}
            </div>
          )}
          {chatLoading && (
            <div className="mt-3 flex items-center gap-1.5" aria-label="Claude is thinking">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-bounce rounded-full bg-ai/80" style={{ animationDelay: `${i * 140}ms` }} />
              ))}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">Claude suggests adding</p>
              {suggestions.map((sg, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => addSuggestion(sg)}
                  disabled={actionLoading}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed border-ai/50 bg-transparent px-2.5 py-1.5 text-left font-sans text-[12.5px] text-foreground hover:bg-ai/10 disabled:opacity-50"
                  title="Add as a child bubble"
                >
                  <Plus className="mt-0.5 size-3.5 shrink-0 text-ai" />
                  <span>
                    <span className="font-medium">{sg.label}</span>
                    {sg.detail && <span className="block text-[11.5px] text-muted-foreground">{sg.detail}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form className="px-4 pb-4" onSubmit={handleSendMessage}>
          {isLocked && <p className="mb-1.5 px-1 text-[11px] text-dim">Unlock to change this bubble.</p>}
          <div className="flex items-end gap-2 rounded-xl border border-input bg-raised px-2.5 py-1.5 focus-within:border-ai/50">
            <textarea
              className="max-h-28 min-h-[22px] flex-1 resize-none border-0 bg-transparent px-1 py-1 font-sans text-[13px] leading-5 text-foreground outline-none placeholder:text-dim"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder={isLocked ? 'Bubble is locked' : cooldownSeconds > 0 ? formatCooldown(cooldownSeconds) : 'Message Claude about this bubble…'}
              rows={1}
              disabled={!chatAllowed || chatLoading || cooldownSeconds > 0}
              aria-label="Message Claude about this bubble"
            />
            <button
              type="submit"
              disabled={!chatAllowed || chatLoading || !chatInput.trim() || cooldownSeconds > 0}
              aria-label="Send"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-ai text-[#0b1a14] disabled:cursor-default disabled:bg-accent disabled:text-dim"
            >
              <ArrowUp className="size-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
