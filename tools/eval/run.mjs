#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scorePlan, scoreBuild, formatMarkdownReport } from "./score.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command line argument parsing
function parseArgs(argv) {
  const options = {
    base: "http://localhost:8888",
    build: false,
    prompts: path.join(__dirname, "prompts.json"),
    out: path.join(__dirname, "report.md"),
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base" && argv[i + 1]) {
      options.base = argv[++i].replace(/\/+$/, "");
    } else if (arg.startsWith("--base=")) {
      options.base = arg.slice("--base=".length).replace(/\/+$/, "");
    } else if (arg === "--build") {
      options.build = true;
    } else if (arg === "--prompts" && argv[i + 1]) {
      options.prompts = path.resolve(argv[++i]);
    } else if (arg.startsWith("--prompts=")) {
      options.prompts = path.resolve(arg.slice("--prompts=".length));
    } else if (arg === "--out" && argv[i + 1]) {
      options.out = path.resolve(argv[++i]);
    } else if (arg.startsWith("--out=")) {
      options.out = path.resolve(arg.slice("--out=".length));
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node tools/eval/run.mjs [options]

Options:
  --base <url>       Local API base URL (default: http://localhost:8888)
  --build            Also run build and evaluate generated HTML
  --prompts <path>   Path to prompts JSON file (default: tools/eval/prompts.json)
  --out <path>       Output Markdown report path (default: tools/eval/report.md)
  -h, --help         Show help
`);
      process.exit(0);
    }
  }

  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiRequest(base, endpoint, method = "GET", body = undefined) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const pathPrefix = cleanEndpoint.startsWith("/api/") ? "" : "/api";
  const url = `${base}${pathPrefix}${cleanEndpoint}`;
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") || "";
  let data;
  if (ct.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok && res.status !== 202) {
    const errDetail = typeof data === "object" ? JSON.stringify(data) : data;
    throw new Error(`API error ${res.status} on ${method} ${endpoint}: ${errDetail}`);
  }

  return { status: res.status, headers: res.headers, body: data };
}

async function runPrompt(base, prompt, shouldBuild) {
  console.log(`\nEvaluating: ${prompt.name || prompt.id}`);

  // 1. Create session
  const sessionRes = await apiRequest(base, "/sessions", "POST");
  const sid = sessionRes.body.id;
  console.log(`  Created session: ${sid}`);

  // 2. Post prompt message
  const msgText = prompt.prompt || prompt.text;
  const msgRes = await apiRequest(base, `/sessions/${sid}/messages`, "POST", { text: msgText });

  // 3. Poll session until turn.status != "pending"
  let session = msgRes.body;
  let attempts = 0;
  const maxAttempts = 90; // 90 * 1000ms = 90s max wait

  // Check if response was 200 with map directly or 202 with turn
  while (session.turn?.status === "pending" && attempts < maxAttempts) {
    attempts++;
    await sleep(1000);
    const pollRes = await apiRequest(base, `/sessions/${sid}`, "GET");
    session = pollRes.body;
    process.stdout.write(".");
  }

  if (session.turn?.status === "pending") {
    throw new Error(`Turn timed out waiting for completion on session ${sid}`);
  }
  if (session.turn?.status === "error") {
    throw new Error(`Turn failed on session ${sid}: ${session.turn.error}`);
  }

  // Ensure we have the latest session map
  if (!session.map) {
    const pollRes = await apiRequest(base, `/sessions/${sid}`, "GET");
    session = pollRes.body;
  }

  const planScore = scorePlan(session.map);
  console.log(`  Plan: ${planScore.nodeCount} nodes, all 4 facets: ${planScore.allFacetsPresent ? "yes" : "no"}, topics: ${planScore.topicsFound}/${planScore.topicsTotal}`);

  let buildScore = null;
  if (shouldBuild) {
    console.log(`  Triggering build...`);
    const buildRes = await apiRequest(base, `/sessions/${sid}/build`, "POST");
    let build = buildRes.body;
    const bid = build.id;

    let buildAttempts = 0;
    while (build.status === "pending" && buildAttempts < maxAttempts) {
      buildAttempts++;
      await sleep(1500);
      let pollBuild;
      try {
        pollBuild = await apiRequest(base, `/sessions/${sid}/builds/${bid}`, "GET");
      } catch (err) {
        // Fallback to /builds/${bid} if the server route structure differs
        pollBuild = await apiRequest(base, `/builds/${bid}`, "GET");
      }
      build = pollBuild.body;
      process.stdout.write(".");
    }

    if (build.status === "pending") {
      throw new Error(`Build timed out waiting for completion on build ${bid}`);
    }
    if (build.status === "error") {
      throw new Error(`Build failed on session ${sid}, build ${bid}: ${build.error}`);
    }

    buildScore = scoreBuild(build);
    console.log(`  Build: ${buildScore.size} bytes, data-mc count: ${buildScore.dataMcCount}, assumed: ${buildScore.hasAssumed ? "yes" : "no"}, href=#: ${buildScore.hasHrefHash ? "yes" : "no"}`);
  }

  return {
    prompt,
    session,
    planScore,
    buildScore,
  };
}

async function main() {
  const options = parseArgs(process.argv);

  console.log(`Starting eval harness`);
  console.log(`  Base API URL: ${options.base}`);
  console.log(`  Prompts file: ${options.prompts}`);
  console.log(`  Build enabled: ${options.build}`);
  console.log(`  Report output: ${options.out}`);

  const promptsRaw = await fs.readFile(options.prompts, "utf8");
  const prompts = JSON.parse(promptsRaw);

  const results = [];
  for (const prompt of prompts) {
    try {
      const res = await runPrompt(options.base, prompt, options.build);
      results.push(res);
    } catch (err) {
      console.error(`  Error evaluating prompt ${prompt.id}:`, err.message);
      results.push({
        prompt,
        planScore: null,
        buildScore: null,
        error: err.message,
      });
    }
  }

  const markdown = formatMarkdownReport(results);
  await fs.writeFile(options.out, markdown, "utf8");
  console.log(`\nEvaluation complete. Report written to ${options.out}`);
  console.log("\n" + markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Eval run failed:", err);
    process.exit(1);
  });
}
