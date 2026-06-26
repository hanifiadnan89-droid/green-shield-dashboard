# Sales Coach Memory & Training Center

How the Sales Coach AI learns and improves over time.

---

## Two layers of learned data

### 1. Dynamic examples — `objection-feedback.json`
Auto-populated from every Objection Coach session where feedback or an outcome is saved. The AI uses past `thumbs_up`, `save_approved`, and `sold` examples to inform future responses. This file is managed automatically — you never edit it directly.

### 2. Training Center — `training-items.json`
Manually curated by the sales manager via the Training Center module. These entries take priority over the auto-learned examples because they represent intentional, reviewed guidance. Each item has a `type`, `title`, `content`, optional `context`, and an `active` toggle.

---

## Training item types

| Type | Purpose | AI usage |
|------|---------|----------|
| `principle` | Core sales beliefs ("lead with value, not price") | Always included in every coaching prompt |
| `approved_response` | Exact wording approved by the manager | Referenced when situation keyword-matches |
| `correction` | What NOT to do + better approach | Referenced when situation keyword-matches |
| `objection_example` | A specific objection and how to handle it | Referenced when situation keyword-matches |
| `playbook_seed` | High-level strategy or tactic | Referenced when situation keyword-matches |

**Principles are always included.** All other types are keyword-matched against the current situation — the top 5 most relevant items are selected.

---

## How training context reaches the AI

```
Coach Me click
  → salesCoachEngine.runObjectionCoach()
      → getTrainingContext(situation, { service })   ← trainingService.js
          → reads training-items.json
          → always includes active principles (up to 3)
          → keyword-scores other active items against situation
          → returns top 5 non-principle matches
      → injects training context block into the user message
      → AI sees: static knowledge + training context + dynamic examples + situation
      → returns 7-key coaching package
```

The training context is injected between the static knowledge base and the dynamic examples, so it shapes tone and strategy without overriding pricing, guarantees, or service rules.

---

## Session persistence

Every `Coach Me` request creates or updates a session record in `sales-coach-sessions.json`:

```json
{
  "id": "client-generated-uuid",
  "module": "objectionCoach",
  "situation": "Customer said $119 is too expensive",
  "serviceType": "tick-mosquito",
  "result": {
    "recommendedResponse": "...",
    "confidence": 87
  },
  "feedback": {
    "type": "thumbs_up",
    "correction": null
  },
  "outcome": {
    "outcome": "sold",
    "outcomeReason": "great_response",
    "saleValue": null,
    "whyItWorked": "Broke down per-day cost"
  },
  "status": "completed",
  "createdAt": "2026-06-25T...",
  "updatedAt": "2026-06-25T..."
}
```

Sessions are stored newest-first. The session history tab in Training Center shows the last 50 sessions.

### Session lifecycle
1. `module` endpoint fires → session created with `result` and `status: active`
2. Feedback button clicked → session updated with `feedback`
3. Outcome saved → session updated with `outcome` and `status: completed`

Session upserts are fire-and-forget — a write failure never blocks the rep's workflow.

---

## What Training Center does NOT do

- **Does not fine-tune or modify the AI model.** The model (Claude) is unchanged. Training items are injected as text context on each request.
- **Does not override static knowledge.** `objection_assistant_coach.md` — pricing, guarantees, service rules — is always loaded and takes precedence.
- **Does not auto-populate training items.** Everything in Training Center was put there by a human. Automatic learning goes into `objection-feedback.json`, not here.

---

## API endpoints

```
GET  /api/ai/sales-coach/sessions          → list recent sessions (query: limit, module)
GET  /api/ai/sales-coach/training          → list training items (query: type)
POST /api/ai/sales-coach/training          → create training item
PUT  /api/ai/sales-coach/training/:id      → update training item (patch)
DEL  /api/ai/sales-coach/training/:id      → delete training item
```
