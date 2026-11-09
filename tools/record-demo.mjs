/**
 * tools/record-demo.mjs
 *
 * Automated Playwright script to record a professional portfolio demo GIF/video for MindCode,
 * replaying the real session and build saved from:
 * https://mindcode1.netlify.app/api/sessions/458a2ac2-eb7/builds/b1/app
 *
 * Every /api call is answered from the saved files in tools/, so no backend or AI credits are needed.
 *
 * Usage (from the repo root; needs Google Chrome and ffmpeg on PATH):
 *   npm install --no-save playwright-core
 *   node node_modules/playwright-core/cli.js install ffmpeg    # Playwright's video encoder
 *   node web/node_modules/vite/bin/vite.js web --port 5190      # in another terminal
 *   node tools/record-demo.mjs                                  # HEADED=1 to watch it
 * Output: recordings/mindcode-portfolio.gif and .mp4 (gitignored).
 */

import { chromium } from 'playwright-core';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TARGET_URL = process.env.MINDCODE_URL || 'http://localhost:5190';
const OUTPUT_DIR = path.resolve('recordings');
const SESSION_FILE = path.resolve('tools/deconstruct-session.json');
const HTML_FILE = path.resolve('tools/deconstruct-b1.html');

// Read the real session and build HTML
if (!fs.existsSync(SESSION_FILE) || !fs.existsSync(HTML_FILE)) {
  console.error('Missing session or HTML file. Run the downloader first.');
  process.exit(1);
}

const baseSession = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
const generatedHtml = fs.readFileSync(HTML_FILE, 'utf8');
// The preview pane loads /builds/b1/preview: the same HTML plus MindCode's tracing script.
// Saved from https://mindcode1.netlify.app/api/sessions/458a2ac2-eb7/builds/b1/preview
const PREVIEW_FILE = path.resolve('tools/deconstruct-b1-preview.html');
const previewHtml = fs.existsSync(PREVIEW_FILE) ? fs.readFileSync(PREVIEW_FILE, 'utf8') : generatedHtml;

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🚀 Launching Playwright browser...');
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1', channel: 'chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });

  // Simulated session progression
  let currentStep = 'init'; // 'init' -> 'chat_sent' -> 'built'
  const sid = '458a2ac2-eb7';

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    // 1. Initial Session creation / fetch
    if (/\/api\/sessions(\?|$)/.test(url) && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: sid,
          messages: [],
          map: { nodes: [], edges: [] },
          builds: [],
          checkpoints: [],
        }),
      });
    }

    if (url.endsWith(`/api/sessions/${sid}`) && method === 'GET') {
      if (currentStep === 'init') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: sid,
            messages: [],
            map: { nodes: [], edges: [] },
            builds: [],
            checkpoints: [],
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...baseSession,
          builds: currentStep === 'built' ? [baseSession.builds[0]] : [],
        }),
      });
    }

    // 2. Chat message turn
    if (url.includes('/messages') && method === 'POST') {
      currentStep = 'chat_sent';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: baseSession.messages[1].text,
          map: baseSession.map,
          changed: baseSession.map.nodes.map((n) => n.id),
        }),
      });
    }

    // 3. Bubble Approval / Patch
    if ((url.includes('/approve') || url.includes('/nodes/')) && method === 'POST') {
      const node = baseSession.map.nodes.find((n) => n.id === 'n7') || baseSession.map.nodes[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...node, status: 'approved' }),
      });
    }

    // 4. Trigger Build
    if (/\/build(\?|$)/.test(url) && method === 'POST') {
      currentStep = 'built';
      const b1 = {
        ...baseSession.builds[0],
        html: generatedHtml,
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(b1),
      });
    }

    // 5. Poll Build Status
    if (/\/builds\/b1(\?|$)/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(baseSession.builds[0]),
      });
    }

    // 6. Serve Build HTML: /preview (traced, shown in the pane) and /app (plain, "Open app")
    if (url.includes('/builds/b1/preview')) {
      return route.fulfill({ status: 200, contentType: 'text/html', body: previewHtml });
    }
    if (url.includes('/builds/b1/app')) {
      return route.fulfill({ status: 200, contentType: 'text/html', body: generatedHtml });
    }

    // Checkpoint timeline: show the saved checkpoints instead of a 500 from the missing backend
    if (url.includes('/checkpoints') && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentStep === 'built' ? baseSession.checkpoints || [] : []) });
    }

    console.log('UNMOCKED', method, url);
    return route.continue();
  });

  console.log(`🌐 Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // 1. Type the real hackathon team prompt
  console.log('💬 Typing prompt in chat composer...');
  const promptText = "We are a hackathon team building a webapp for hackathon teams. First idea: Deconstruct your prompt to understand it, and Claude's assumptions.";
  const textarea = page.locator('textarea[aria-label="Message Claude"]');
  await textarea.click();
  for (const char of promptText) {
    await textarea.type(char, { delay: 14 });
  }
  await page.waitForTimeout(500);

  // Click Send
  const sendBtn = page.locator('button[aria-label="Send message"]');
  await sendBtn.click();

  // 2. Wait for the 34 Mind Map bubbles to animate into view
  console.log('🔮 Waiting for mind map to populate...');

  await page.waitForSelector('.react-flow__node', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // 3. Click one of the inferred assumption bubbles (e.g., Color / Brand)
  console.log('🔍 Clicking assumption bubble...');
  const targetNode = page.locator('.react-flow__node:has-text("Color"), .react-flow__node:has-text("Brand"), [data-id="n7"]').first();
  if (await targetNode.isVisible()) {
    await targetNode.click();
    await page.waitForTimeout(1200);

    // Click Approve in the bubble drawer
    const approveBtn = page.locator('button:has-text("Approve"), .drawer-approve-btn').first();
    if (await approveBtn.isVisible()) {
      console.log('✅ Approving bubble in drawer...');
      await approveBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // 4. Click Build App
  console.log('⚡ Triggering app build...');
  const buildBtn = page.locator('button:has-text("Build App"), .build-btn').first();
  await buildBtn.click();

  // Wait for the preview iframe to load the generated Deconstruct website
  console.log('🖥️ Waiting for Deconstruct website to appear in preview iframe...');
  await page.waitForSelector('iframe.preview-frame', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 5. Demonstrate Bidirectional Traceability with the real Deconstruct elements
  console.log('✨ Demonstrating bidirectional traceability...');
  const frameElement = await page.$('iframe.preview-frame');
  if (frameElement) {
    const frame = await frameElement.contentFrame();
    if (frame) {
      // Hover over the header logo (>_ deconstruct) -> lights up n1 & n6
      const logoEl = frame.locator('.logo, [data-mc-el="e2"]').first();
      if (await logoEl.isVisible()) {
        const box = await logoEl.boundingBox();
        if (box) {
          console.log('👉 Hovering logo in preview -> lights up n1 (Prompt deconstruction) & n6 (Brand)');
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(2200);
        }
      }

      // Hover over the Assumption map nav tab -> lights up n13
      const navTab = frame.locator('button[data-view="map"], [data-mc-el="e6"]').first();
      if (await navTab.isVisible()) {
        const box = await navTab.boundingBox();
        if (box) {
          console.log('👉 Hovering Assumption map tab in preview -> lights up n13');
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(2000);
        }
      }

      // Hover over the CTA button ("Deconstruct a prompt ->") -> lights up n11 & n15
      const ctaBtn = frame.locator('#ctaStart, [data-mc-el="e12"]').first();
      if (await ctaBtn.isVisible()) {
        const box = await ctaBtn.boundingBox();
        if (box) {
          console.log('👉 Hovering CTA button in preview -> lights up n11 & n15');
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(1500);

          // Click the CTA button inside the generated web app to show it is a REAL working app!
          console.log('🖱️ Clicking CTA inside generated app to switch to Workspace view...');
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(2500);
        }
      }
    }
  }

  console.log('🎬 Wrapping up recording...');
  await page.waitForTimeout(1500);

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const videoPath = await video.path();
    const finalMp4 = path.join(OUTPUT_DIR, 'mindcode-portfolio.mp4');
    const finalGif = path.join(OUTPUT_DIR, 'mindcode-portfolio.gif');
    console.log(`📹 Raw video saved at: ${videoPath}`);

    try {
      console.log('⚙️ Converting video to high-quality GIF with ffmpeg...');
      // 2-pass palette generation for crisp colors without banding
      execSync(`ffmpeg -y -i "${videoPath}" -vf "fps=16,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${finalGif}"`);
      console.log(`🎉 Demo GIF created: ${finalGif}`);

      execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p -crf 23 "${finalMp4}"`);
      console.log(`🎉 Demo MP4 created: ${finalMp4}`);
    } catch (err) {
      console.warn('ffmpeg conversion note:', err.message);
    }
  }

  console.log('✅ Done! Portfolio demo recording ready.');
}

main().catch((err) => {
  console.error('Fatal error during recording:', err);
  process.exit(1);
});
