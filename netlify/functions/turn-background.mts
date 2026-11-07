// Background function: processes a pending chat turn (Claude updates the map). A full build plan
// (25-35 bubbles from Opus) can exceed the 30 s sync limit; background functions get 15 min.
// Body: {"sid": "..."}. The client polls GET /api/sessions/{sid} until turn.status != "pending".
import { ai } from "../../api/ai";
import { runTurn } from "../../api/router";
import { blobStorage } from "../../api/storage";

export default async (req: Request) => {
  const { sid } = (await req.json()) as { sid: string };
  await runTurn({ storage: blobStorage(), ai }, sid);
};
