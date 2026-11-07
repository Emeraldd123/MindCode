import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkQuality, QUALITY_WEIGHTS } from "./quality";

const CLEAN_SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Clean Minimalist Workspace</title>
</head>
<body>
  <header>
    <h1>Welcome to Study Space</h1>
    <a href="/dashboard">Go to Dashboard</a>
  </header>
  <main>
    <section>
      <img src="avatar.png" alt="User avatar">
      <form>
        <label for="username">Username</label>
        <input id="username" type="text">
        <label>
          Password
          <input id="pwd" type="password">
        </label>
        <input type="text" placeholder="Optional notes" aria-label="Notes">
        <button type="submit">Log in</button>
      </form>
    </section>
  </main>
  <script>
    console.log("ready");
  </script>
</body>
</html>`;

describe("checkQuality", () => {
  it("scores clean sample >= 90 with zero defects", () => {
    const report = checkQuality(CLEAN_SAMPLE_HTML);
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.assumedNotes).toBe(0);
    expect(report.placeholders).toBe(0);
    expect(report.deadLinks).toBe(0);
    expect(report.buttonsWithoutText).toBe(0);
    expect(report.imagesWithoutAlt).toBe(0);
    expect(report.inputsWithoutLabel).toBe(0);
    expect(report.hasViewportMeta).toBe(true);
    expect(report.hasTitle).toBe(true);
    expect(report.inlineScriptCount).toBe(1);
    expect(report.externalScripts).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it("detects visible Assumed: notes and lowers the score", () => {
    const htmlWithAssumed = CLEAN_SAMPLE_HTML.replace(
      "<h1>Welcome to Study Space</h1>",
      "<h1>Welcome to Study Space</h1><p>Assumed: user needs dark mode</p><p>assumed: offline first</p>"
    );
    const report = checkQuality(htmlWithAssumed);
    expect(report.assumedNotes).toBe(2);
    expect(report.issues).toContain('Found 2 visible "Assumed:" note(s)');
    expect(report.score).toBe(100 - 2 * QUALITY_WEIGHTS.ASSUMED_NOTE);
  });

  it("does not count Assumed: inside script comments or code", () => {
    const html = CLEAN_SAMPLE_HTML.replace(
      'console.log("ready");',
      '// Assumed: database is online\nconst x = "Assumed: value";'
    );
    const report = checkQuality(html);
    expect(report.assumedNotes).toBe(0);
  });

  it("detects placeholders and lists the issue", () => {
    const html = CLEAN_SAMPLE_HTML.replace(
      "<h1>Welcome to Study Space</h1>",
      "<h1>Lorem ipsum dolor sit amet</h1><p>Created by John Doe and Jane Doe at Acme. TODO: add Jordan Lee. Feature coming soon.</p>"
    );
    const report = checkQuality(html);
    // lorem ipsum, John Doe, Jane Doe, Acme, TODO, Jordan Lee, coming soon = 7 occurrences
    expect(report.placeholders).toBe(7);
    expect(report.issues.some((issue) => issue.includes("placeholder"))).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it("detects dead links with empty href or href='#'", () => {
    const html = CLEAN_SAMPLE_HTML.replace(
      '<a href="/dashboard">Go to Dashboard</a>',
      '<a href="#">Home</a><a href="">About</a><a href="  ">Contact</a>'
    );
    const report = checkQuality(html);
    expect(report.deadLinks).toBe(3);
    expect(report.issues.some((issue) => issue.includes("dead link"))).toBe(true);
    expect(report.score).toBe(100 - 3 * QUALITY_WEIGHTS.DEAD_LINK);
  });

  it("detects buttons without text or aria-label", () => {
    const html = CLEAN_SAMPLE_HTML.replace(
      '<button type="submit">Log in</button>',
      '<button type="button"></button><button type="button"><span></span></button><button type="button" aria-label="Save">💾</button>'
    );
    const report = checkQuality(html);
    // First two have no text and no aria-label; the third has aria-label
    expect(report.buttonsWithoutText).toBe(2);
    expect(report.issues.some((issue) => issue.includes("button(s) with no text"))).toBe(true);
  });

  it("detects images without alt attribute", () => {
    const html = CLEAN_SAMPLE_HTML.replace(
      '<img src="avatar.png" alt="User avatar">',
      '<img src="avatar.png"><img src="bg.png" alt="Background">'
    );
    const report = checkQuality(html);
    expect(report.imagesWithoutAlt).toBe(1);
    expect(report.issues.some((issue) => issue.includes("image(s) missing alt"))).toBe(true);
  });

  it("detects inputs without label, aria-label, or placeholder", () => {
    const html = CLEAN_SAMPLE_HTML.replace(
      '<label for="username">Username</label>\n        <input id="username" type="text">',
      '<input id="unlabeled1" type="text"><input type="email">'
    );
    const report = checkQuality(html);
    expect(report.inputsWithoutLabel).toBe(2);
    expect(report.issues.some((issue) => issue.includes("input(s) with no associated label"))).toBe(true);
  });

  it("detects missing viewport meta tag", () => {
    const html = CLEAN_SAMPLE_HTML.replace('<meta name="viewport" content="width=device-width, initial-scale=1">', "");
    const report = checkQuality(html);
    expect(report.hasViewportMeta).toBe(false);
    expect(report.issues).toContain('Missing <meta name="viewport"> tag');
    expect(report.score).toBe(100 - QUALITY_WEIGHTS.MISSING_VIEWPORT);
  });

  it("detects missing or empty title tag", () => {
    const htmlNoTitle = CLEAN_SAMPLE_HTML.replace(/<title>[\s\S]*?<\/title>/, "");
    const report1 = checkQuality(htmlNoTitle);
    expect(report1.hasTitle).toBe(false);
    expect(report1.issues).toContain("Missing or empty <title> tag");

    const htmlEmptyTitle = CLEAN_SAMPLE_HTML.replace(/<title>[\s\S]*?<\/title>/, "<title>   </title>");
    const report2 = checkQuality(htmlEmptyTitle);
    expect(report2.hasTitle).toBe(false);
  });

  it("detects external scripts", () => {
    const html = CLEAN_SAMPLE_HTML.replace(
      "</body>",
      '<script src="https://cdn.example.com/lib.js"></script></body>'
    );
    const report = checkQuality(html);
    expect(report.externalScripts).toBe(1);
    expect(report.issues.some((issue) => issue.includes("external script"))).toBe(true);
    expect(report.score).toBe(100 - QUALITY_WEIGHTS.EXTERNAL_SCRIPT);
  });

  it("runs on the demo session HTML from api/demo/study-group.json and asserts assumedNotes === 0", () => {
    const demoJsonPath = resolve(__dirname, "demo", "study-group.json");
    const demoSession = JSON.parse(readFileSync(demoJsonPath, "utf-8"));
    const buildHtml = demoSession.builds?.[0]?.html;
    expect(typeof buildHtml).toBe("string");
    expect(buildHtml.length).toBeGreaterThan(0);

    const report = checkQuality(buildHtml);
    expect(report.assumedNotes).toBe(0);
    expect(report.hasViewportMeta).toBe(true);
    expect(report.hasTitle).toBe(true);
    expect(report.externalScripts).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });
});
