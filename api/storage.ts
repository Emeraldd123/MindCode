// Session persistence: Netlify Blobs in functions / `netlify dev`, plain memory in tests.
import { getStore } from "@netlify/blobs";
import type { Session } from "./types";

export interface Storage {
  get(sid: string): Promise<Session | null>;
  put(s: Session): Promise<void>;
}

export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    async get(sid) {
      const v = m.get(sid);
      return v ? JSON.parse(v) : null;
    },
    async put(s) {
      m.set(s.id, JSON.stringify(s));
    },
  };
}

export function blobStorage(): Storage {
  // strong consistency: the build background function writes, the poll route reads right after.
  const store = getStore({ name: "sessions", consistency: "strong" });
  return {
    async get(sid) {
      return ((await store.get(sid, { type: "json" })) as Session | null) ?? null;
    },
    async put(s) {
      await store.setJSON(s.id, s);
    },
  };
}
