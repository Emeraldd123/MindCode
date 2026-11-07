# API contract (web/ ↔ api/)

The only routes the frontend may call. The backend owner edits this file and posts on the board when it changes.

Base URL: `VITE_API_URL` (default `http://localhost:8000`).

| Method | Path | Request | Response | Status |
|---|---|---|---|---|
| GET | `/health` | — | `{ "ok": true }` | planned |

_Add routes once the idea is final._
