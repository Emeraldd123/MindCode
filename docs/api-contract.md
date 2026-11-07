# API contract (web/ ↔ api/)

The only routes the frontend may call. Any PR that adds or changes a route updates this file in the same PR and posts on the board when it lands.

Base URL: `VITE_API_URL` (default `http://localhost:8000`).

| Method | Path | Request | Response | Status |
|---|---|---|---|---|
| GET | `/health` | — | `{ "ok": true }` | planned |

_Add routes once the idea is final._
