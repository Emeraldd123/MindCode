import { describe, expect, it } from "vitest";
import { applyElementStyle, parsePatch, setDeclarations, StyleError } from "./style";

const page = `<body><h1 data-mc-el="e1" data-mc="n1" class="t">Hello</h1>` +
  `<p data-mc-el="e2" data-mc="n2" style="color: red; font-size: 10px">Hi <b>there</b></p>` +
  `<input data-mc-el="e3" data-mc="n3"/></body>`;

describe("style widgets: applyElementStyle", () => {
  it("adds a style attribute with font size and family", () => {
    const out = applyElementStyle(page, "e1", { fontSize: 32, fontFamily: "Georgia, serif" });
    expect(out).toContain(`<h1 data-mc-el="e1" data-mc="n1" class="t" style="font-size: 32px; font-family: Georgia, serif">Hello</h1>`);
  });

  it("replaces an existing declaration and keeps the others", () => {
    const out = applyElementStyle(page, "e2", { fontSize: 18 });
    expect(out).toContain(`style="color: red; font-size: 18px"`);
    expect(out).not.toContain("font-size: 10px");
  });

  it("removes an override with null", () => {
    const out = applyElementStyle(page, "e2", { fontSize: null });
    expect(out).toContain(`style="color: red"`);
  });

  it("handles void / self-closing tags", () => {
    const out = applyElementStyle(page, "e3", { fontSize: 20 });
    expect(out).toContain(`<input data-mc-el="e3" data-mc="n3" style="font-size: 20px"/>`);
  });

  it("changes plain text and escapes it", () => {
    const out = applyElementStyle(page, "e1", { text: "Ben's <Portfolio>" });
    expect(out).toContain(`class="t">Ben's &lt;Portfolio&gt;</h1>`);
  });

  it("refuses text changes on elements with child elements, and unknown ids", () => {
    expect(() => applyElementStyle(page, "e2", { text: "x" })).toThrow(StyleError);
    expect(() => applyElementStyle(page, "e3", { text: "x" })).toThrow(StyleError);
    expect(() => applyElementStyle(page, "e99", { fontSize: 12 })).toThrow(StyleError);
  });

  it("does not match a longer id that starts the same", () => {
    const html = `<p data-mc-el="e10">a</p><p data-mc-el="e1">b</p>`;
    expect(applyElementStyle(html, "e1", { fontSize: 9 })).toBe(`<p data-mc-el="e10">a</p><p data-mc-el="e1" style="font-size: 9px">b</p>`);
  });
});

describe("style widgets: parsePatch / setDeclarations", () => {
  it("validates input", () => {
    expect(parsePatch({ el: "e1", fontSize: "24" })).toEqual({ el: "e1", patch: { fontSize: 24 } });
    expect(parsePatch({ el: "e1", fontFamily: `"Hiragino Sans", sans-serif` }).patch.fontFamily).toBe(`'Hiragino Sans', sans-serif`);
    expect(() => parsePatch({ el: "e1" })).toThrow(StyleError);
    expect(() => parsePatch({ el: "e1", fontSize: 999 })).toThrow(StyleError);
    expect(() => parsePatch({ el: "e1", fontFamily: "x;}body{display:none" })).toThrow(StyleError);
    expect(() => parsePatch({ el: "<script>", fontSize: 12 })).toThrow(StyleError);
  });

  it("sets and removes declarations", () => {
    expect(setDeclarations("color: red; FONT-SIZE: 3px;", { "font-size": "4px" })).toBe("color: red; font-size: 4px");
    expect(setDeclarations("", { "font-family": null })).toBe("");
  });
});
