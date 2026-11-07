// Run against Vite: PLAYWRIGHT_MODULE=/path/to/playwright node web/tests/treeExplorer.browser.cjs
// Optional: VITE_TEST_URL, CHROMIUM_PATH. Uses local fixtures; no backend or paid APIs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/tree-explorer-test', route => route.fulfill({ contentType: 'text/html', body: `
      <html><head><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/ui/theme.css"></head>
      <body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type;
        window.__vite_plugin_react_preamble_installed__=true;
        const {default:React} = await import('/node_modules/.vite/deps/react.js');
        const {default:{createRoot}} = await import('/node_modules/.vite/deps/react-dom_client.js');
        const {default:TreeMap} = await import('/src/TreeMap.jsx');
        const map={nodes:[
          {id:'root',label:'Project',kind:'goal'},
          {id:'branch',label:'Design',parent:'root',kind:'feature'},
          {id:'leaf',label:'Colors',parent:'branch',kind:'style'},
          {id:'sibling',label:'Search',parent:'root',kind:'feature'}
        ],edges:[]};
        function App(){
          const [highlighted,setHighlighted]=React.useState([]);
          return React.createElement('div',null,
            React.createElement('button',{id:'hover',onMouseEnter:()=>setHighlighted(['leaf']),onMouseLeave:()=>setHighlighted([])},'Preview hover'),
            React.createElement('div',{style:{width:900,height:700,marginLeft:650}},React.createElement(TreeMap,{map,highlighted,onSelect:node=>{window.selected=node?.id;}})));
        }
        createRoot(document.getElementById('root')).render(React.createElement(App));
      </script></body></html>` }));
    await page.goto(`${process.env.VITE_TEST_URL || 'http://127.0.0.1:5173'}/tree-explorer-test`);
    const root = page.locator('.react-flow__node[data-id="root"]');
    await root.waitFor({ state: 'visible' });
    await page.waitForTimeout(700); // initial fit animation
    const viewport = page.locator('.react-flow__viewport').first();
    const originalTransform = await viewport.getAttribute('style');
    await root.hover();
    const overlay = page.getByRole('region', { name: 'Bubble graph preview', exact: true });
    await overlay.waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.keyboard.press('Escape');
    await overlay.waitFor({ state: 'hidden' });
    await page.mouse.move(1590, 850);
    await root.hover();
    await overlay.waitFor({ state: 'visible' });
    assert.equal(await overlay.locator('.react-flow__node-bubble').count(), 2);
    const bounds = await overlay.boundingBox();
    assert.equal(bounds.x, 16);
    assert.equal(bounds.width, 640);
    assert.equal(bounds.height, 760);
    assert.equal(await overlay.evaluate(el => el.parentElement === document.body), true);
    await overlay.hover();
    await page.waitForTimeout(600);
    assert.equal(await overlay.isVisible(), true);
    await overlay.locator('.react-flow__node[data-id="branch"]').click();
    await overlay.locator('.react-flow__node[data-id="leaf"]').waitFor({ state: 'visible' });
    await overlay.getByRole('button', { name: 'Back to parent bubble', exact: true }).click();
    await overlay.locator('.react-flow__node[data-id="branch"]').waitFor({ state: 'visible' });
    await overlay.getByRole('button', { name: 'Close bubble preview' }).click();
    await overlay.waitFor({ state: 'hidden' });
    assert.equal(await viewport.getAttribute('style'), originalTransform);
    const leaf = page.locator('.react-flow__node[data-id="leaf"]');
    await leaf.hover();
    await overlay.waitFor({ state: 'visible' });
    assert.equal(await overlay.locator('.react-flow__node[data-id="leaf"] .node-highlighted').count(), 1);
    await page.locator('.react-flow__node[data-id="sibling"]').first().click();
    assert.equal(await page.evaluate(() => window.selected), 'sibling');
    await page.keyboard.press('Escape');
    await overlay.waitFor({ state: 'hidden' });
    await root.hover();
    await overlay.waitFor({ state: 'visible' });
    await page.mouse.move(1590, 850);
    await overlay.waitFor({ state: 'hidden' });
    await page.hover('#hover');
    assert.equal(await page.locator('.react-flow__node').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).visibility === 'visible')), true);
    assert.deepEqual(errors, []);
    console.log('PASS: hover overlay, large left popup bounds, pointer transfer, drill-in/back, close/Escape/leave, viewport preservation, leaf highlight, click details, preview hover');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
