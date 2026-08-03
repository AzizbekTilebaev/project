# Public API v1 (partner keys)

Base: `/api/v1`

## Auth
Send `X-Api-Key: <secret>` (or `Authorization: Bearer <secret>`).

Keys are minted by import-key owners:

```http
POST /api/v1/clients
X-Import-Key: <IMPORT_API_KEY>
Content-Type: application/json

{ "name": "My App", "rpm": 600, "rpd": 50000 }
```

Response includes the raw `apiKey` **once**. Store it server-side; never embed in a SPA.

## Quotas
- Default **600 requests/minute** and **50,000/day** per key.
- Exceeding returns HTTP 429.
- “10,000 users” is a capacity planning target, not an unlimited guarantee.

## Endpoints
| Method | Path | Notes |
|--------|------|--------|
| GET | `/manifest` | Schema/content versions (no key required) |
| GET | `/dictionary/search?q=` | Search |
| GET | `/dictionary/words/:id` | Word + immersion metadata |
| GET | `/quizzes` | Quiz list |
| GET | `/quizzes/:id` | Public quiz (no answer key) |

## Updates
`GET /api/v1/manifest` exposes `schemaVersion` and `contentVersion` for clients to detect updates.
Commercial “lifetime” entitlements are a business policy; the platform tracks versions here.
