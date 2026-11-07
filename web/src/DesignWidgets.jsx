import React, { useEffect, useRef, useState } from 'react';
import * as api from './api';
import { applyLive, currentPreview, flashElement, inspectNodes, onPreviewChange } from './previewBridge';
import { clampFontSize, elementLabel, FONT_OPTIONS, FONT_SIZE_MAX, FONT_SIZE_MIN, isLeaf, matchFont } from './designLogic';

const MAX_ELEMENTS = 8;
const SAVE_DELAY_MS = 600;

/**
 * Design widgets for a leaf bubble: for each element of the built app this bubble shaped,
 * change its font size, font and (plain) text. Changes show in the preview at once and are
 * saved into the build after a short pause (POST /api/sessions/{sid}/builds/{bid}/style).
 */
export default function DesignWidgets({ sessionId, node, map, onError = () => {} }) {
  const leaf = isLeaf(node, map);
  const [items, setItems] = useState([]);
  const [values, setValues] = useState({}); // el -> { fontSize, fontFamily, text }
  const [notes, setNotes] = useState({}); // el -> 'saving' | 'saved' | 'preview only'
  const pending = useRef({}); // el -> { patch, timer, buildId }

  // (Re)inspect when the bubble changes or the preview loads a new build.
  useEffect(() => {
    if (!leaf) return undefined;
    let cancelled = false;
    const load = () => {
      inspectNodes([node.id]).then((found) => {
        if (cancelled) return;
        const list = found.slice(0, MAX_ELEMENTS);
        setItems(list);
        setValues(Object.fromEntries(list.map((it) => [it.el, {
          fontSize: clampFontSize(it.fontSize) ?? 16,
          fontFamily: matchFont(it.fontFamily),
          text: it.text,
        }])));
        setNotes({});
      });
    };
    load();
    const off = onPreviewChange(load);
    return () => { cancelled = true; off(); };
  }, [leaf, node.id]);

  // Flush unsaved changes when the panel closes.
  useEffect(() => () => {
    Object.keys(pending.current).forEach((el) => {
      clearTimeout(pending.current[el].timer);
      save(el);
    });
  }, []);

  function save(el) {
    const p = pending.current[el];
    delete pending.current[el];
    if (!p || !sessionId) return;
    setNotes((n) => ({ ...n, [el]: 'saving' }));
    api.styleBuild(sessionId, p.buildId, { el, ...p.patch })
      .then(() => setNotes((n) => ({ ...n, [el]: 'saved' })))
      .catch((err) => {
        // 422: the element is drawn by the app's own script, so there's no static HTML to rewrite.
        if (err?.status === 422 || /422/.test(err?.message || '')) setNotes((n) => ({ ...n, [el]: 'preview only' }));
        else onError(err?.message || 'Could not save the design change');
      });
  }

  function change(el, patch) {
    setValues((v) => ({ ...v, [el]: { ...v[el], ...patch } }));
    applyLive(el, patch);
    const buildId = currentPreview()?.buildId;
    if (!buildId) return;
    const prev = pending.current[el];
    if (prev) clearTimeout(prev.timer);
    pending.current[el] = {
      buildId,
      patch: { ...(prev?.patch || {}), ...patch },
      timer: setTimeout(() => save(el), SAVE_DELAY_MS),
    };
  }

  if (!leaf || items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">Design</p>
      {items.map((it) => {
        const v = values[it.el] || {};
        return (
          <div key={it.el} className="flex flex-col gap-2 rounded-md border border-hairline bg-raised/40 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-[12.5px] font-medium text-foreground shadow-none hover:underline"
                style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit' }}
                title="Show in the preview"
                onClick={() => flashElement(it.el)}
              >
                {elementLabel(it)}
              </button>
              {notes[it.el] && <span className="shrink-0 text-[10.5px] text-dim">{notes[it.el]}</span>}
            </div>

            {it.textEditable && (
              <label className="flex flex-col gap-1 text-[11px] text-dim">
                Text
                <input
                  type="text"
                  className="rounded border border-hairline bg-background px-2 py-1 text-[13px] text-foreground"
                  value={v.text ?? ''}
                  onChange={(e) => change(it.el, { text: e.target.value })}
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-[11px] text-dim">
              Font size
              <span className="flex items-center gap-2">
                <input
                  type="range"
                  className="flex-1"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={v.fontSize ?? 16}
                  onChange={(e) => change(it.el, { fontSize: clampFontSize(e.target.value) })}
                  aria-label="Font size"
                />
                <input
                  type="number"
                  className="w-14 rounded border border-hairline bg-background px-1.5 py-0.5 text-right text-[12px] text-foreground"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={v.fontSize ?? 16}
                  onChange={(e) => {
                    const n = clampFontSize(e.target.value);
                    if (n !== null) change(it.el, { fontSize: n });
                  }}
                  aria-label="Font size in px"
                />
                <span>px</span>
              </span>
            </label>

            <label className="flex flex-col gap-1 text-[11px] text-dim">
              Font
              <select
                className="rounded border border-hairline bg-background px-1.5 py-1 text-[12.5px] text-foreground"
                value={v.fontFamily ?? ''}
                onChange={(e) => change(it.el, { fontFamily: e.target.value || null })}
              >
                <option value="">Current ({String(it.fontFamily || '').split(',')[0].replace(/["']/g, '') || 'default'})</option>
                {FONT_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value} style={{ fontFamily: o.value }}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        );
      })}
    </div>
  );
}
