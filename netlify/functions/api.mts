// Every /api/* route. Logic lives in api/router.ts.
import type { Config } from "@netlify/functions";
import { ai } from "../../api/ai";
import { handle, runBuild } from "../../api/router";
import { blobStorage } from "../../api/storage";

export default async (req: Request) => {
  const storage = blobStorage();
  return handle(req, {
    storage,
    ai,
    async startBuild(sid, bid) {
      if (process.env.MINDCODE_FAKE_LLM === "1") return runBuild({ storage, ai }, sid, bid);
      // LLM builds can exceed the 30 s sync limit, so hand off to the background function (15 min).
      const res = await fetch(new URL("/.netlify/functions/build-background", req.url), {
        method: "POST",
        body: JSON.stringify({ sid, bid }),
      });
      if (!res.ok) throw new Error(`could not start build: ${res.status}`);
    },
  });
};

export const config: Config = { path: "/api/*" };
