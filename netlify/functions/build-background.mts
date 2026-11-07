// Background function (name ends in -background): Netlify answers 202 at once and lets this run up to 15 min.
// Body: {"sid": "...", "bid": "b1"}. The client polls GET /api/sessions/{sid}/builds/{bid}.
import { ai } from "../../api/ai";
import { runBuild } from "../../api/router";
import { blobStorage } from "../../api/storage";

export default async (req: Request) => {
  const { sid, bid } = (await req.json()) as { sid: string; bid: string };
  await runBuild({ storage: blobStorage(), ai }, sid, bid);
};
