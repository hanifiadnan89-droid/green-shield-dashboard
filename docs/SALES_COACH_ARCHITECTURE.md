# Sales Coach Architecture

## What is Sales Coach?

Sales Coach is a standalone first-class application inside the Green Shield dashboard.
It is **not a chatbot**. It is a professional, module-based coaching environment —
similar in feel to Salesforce, HubSpot, or Gong — built specifically for live phone
sales situations at Green Shield Pest Solutions.

The rep uses it during or before a sales call to get real-time, context-aware coaching.
Each interaction is a structured "coaching session" — not a chat thread.

---

## Route

```
/sales-coach          → SalesCoachPage (home dashboard)
                        ↓ module selected
                        → renders module component inline
```

---

## Frontend Structure

```
client/src/pages/SalesCoach/
  SalesCoachPage.jsx            — home dashboard; module registry + routing
  SalesCoach.css                — all .sc- and .oc- scoped styles

  components/
    SalesCoachHeader.jsx        — shared header (home + module view)
    SalesCoachModuleCard.jsx    — card in the 3-column module grid
    SalesCoachRecentSessions.jsx — session history panel (in-memory for now)

  modules/
    ObjectionCoach/             — Module 1: Handle an Objection
      ObjectionCoach.jsx        — orchestrator; owns API state
      ObjectionCoachForm.jsx    — left-panel form (owns its own UI state)
      ObjectionCoachResult.jsx  — 7-section result display + copy buttons
      ObjectionCoachFeedback.jsx— thumbs up/down/star + correction
      ObjectionCoachOutcome.jsx — outcome + reason + details tracking
      constants.js              — CATEGORIES, SERVICES, PERSONALITIES, OUTCOMES, REASONS

  hooks/
    useSalesCoachSession.js     — in-memory session lifecycle

  api/
    salesCoachApi.js            — thin wrapper; decouples modules from api/client.js

  utils/
    salesCoachFormatters.js     — label lookups, emoji, timestamp formatting
```

### Adding a New Module

1. Create `modules/NewModule/NewModule.jsx` (and sub-components as needed)
2. Add an entry to `MODULES` in `SalesCoachPage.jsx`
3. Add a handler to `MODULE_VIEWS` in `SalesCoachPage.jsx`
4. Implement `runNewModule(params)` in `server/services/salesCoachEngine.js`
5. Register it in `MODULE_HANDLERS` in `salesCoachEngine.js`

No page-level refactoring is needed for new modules.

---

## Session Model

Every coaching interaction belongs to a session. Sessions are tracked in-memory
on the frontend. The `sessionId` is included in all API payloads so the backend
can persist sessions when that feature is built.

```js
{
  id:                string,   // crypto.randomUUID()
  createdAt:         ISO,
  updatedAt:         ISO,
  module:            string,   // 'objectionCoach' | 'pricingCoach' | ...
  customerName:      string | null,
  serviceType:       string | null,
  situation:         string | null,
  outcome:           string | null,  // 'sold' | 'scheduled' | 'follow_up' | 'lost' | 'unknown'
  status:            'active' | 'completed' | 'abandoned',
  lastResultSummary: string | null,
}
```

Session lifecycle (via `useSalesCoachSession`):
- `startSession(data)` — called when rep clicks "Coach Me"
- `updateSession(updates)` — called when AI result arrives
- `completeSession(outcomeId, summary)` — called when outcome is saved

---

## Backend Structure

```
server/
  routes/ai.js                           — HTTP routing and validation
  services/
    salesCoachEngine.js                  — Strategy Engine (AI calls, per-module)
    objectionKnowledge.js                — Learning + Retrieval Engine
    embeddingService.js                  — AI Provider Layer (OpenAI embeddings)
    knowledge.js                         — General knowledge loader (existing)
  knowledge/
    objection_assistant_coach.md         — STATIC knowledge (never auto-modified)
  data/
    objection-feedback.json              — DYNAMIC cases (feedback + outcomes)
    objection-feedback-embeddings.json   — Semantic vectors (id → float[])
```

### New Endpoints

```
POST /api/ai/sales-coach/module
  Body: { module, sessionId, ...moduleParams }
  Dispatches to salesCoachEngine.runSalesCoachModule(module, params)
  Returns: module-specific JSON result

POST /api/ai/coach-objection   (compatibility alias — not deprecated)
  Still works; forwards to runObjectionCoach internally
```

### Existing Endpoints (unchanged)

```
POST /api/ai/sales-coach         — Property Intelligence widget (3-section output)
POST /api/ai/objection-assist    — Property Intelligence transform (shorten/softer/stronger)
POST /api/ai/objection-feedback  — Quick feedback (👍/👎/⭐ + correction)
POST /api/ai/objection-outcome   — Full sales case save
```

---

## Knowledge Architecture

### Rule: Static knowledge is never overridden by dynamic data.

#### Static Knowledge (objection_assistant_coach.md)
- Pricing tables (IQ, T/M, RIT, BIT, bundles)
- Approved safety and guarantee wording
- Tone rules (required + forbidden phrases)
- Curated objection strategies with key angles
- Cost of inaction arguments
- Approved closing language

**Modifications**: Human-only. File is read at server startup and cached.
The AI cannot change it. Dynamic cases cannot override it.

#### Dynamic Sales Cases (objection-feedback.json)
- Quick feedback (thumbs_up / thumbs_down / save_approved)
- Full outcome cases (Sold / Scheduled / Follow Up / Lost / Unknown)
- Rep corrections ("what I actually said that worked")
- Why it worked (rep's own notes)
- Semantic embeddings (stored separately in objection-feedback-embeddings.json)

**Modifications**: Append-only via `/objection-feedback` and `/objection-outcome` endpoints.
Limited to 1,000 entries (FIFO eviction).

---

## Sales Case Model

```js
{
  id:                  string,   // 'oa-{timestamp}-{random}'
  timestamp:           ISO,
  recordType:          'feedback' | 'case',
  repQuestion:         string,   // what the rep described
  customerObjection:   string,   // what the customer actually said
  serviceType:         string | null,
  propertyContext:     object | null,
  leadContext:         object | null,
  recommendedResponse: string,   // what the AI suggested
  softerVersion:       string,
  salesAngle:          string,
  repEditedResponse:   string | null,   // what the rep actually said
  feedbackType:        'thumbs_up' | 'thumbs_down' | 'save_approved' | null,
  correction:          string | null,   // rep's better version
  outcome:             string | null,   // 'sold' | 'scheduled' | 'follow_up' | 'lost' | 'unknown'
  outcomeReason:       string | null,   // e.g. 'price_overcome' | 'timing' | ...
  saleValue:           number | null,
  whyItWorked:         string | null,
  user:                string | null,
  sessionId:           string | null,
}
```

---

## Retrieval Flow (Objection Coach)

```
rep submits situation
  ↓
salesCoachEngine.runObjectionCoach()
  ↓
objectionKnowledge.getRelevantExamplesWithFallback()
  ├── if OPENAI_API_KEY present → semantic retrieval
  │     generateEmbedding(richQueryDoc)
  │     cosineSimilarity × each stored embedding
  │     composite score = cosine×0.65 + priority×0.35
  │     lazy backfill for un-embedded existing entries
  └── fallback → keyword tokenization (stop-word filtered)
  ↓
formatExamplesForPrompt(examples)
  ↓
buildObjectionCoachUserMessage(situation, ..., knowledge, examples)
  [Static knowledge injected above dynamic examples]
  ↓
Claude claude-sonnet-4-6 → 7-section JSON result
```

### Priority Scoring

| Outcome       | Base score |
|---------------|-----------|
| sold          | 1.00      |
| scheduled     | 0.90      |
| follow_up     | 0.60      |
| unknown       | 0.45      |
| lost/declined | 0.20 (only if correction or whyItWorked present) |
| lost/declined | EXCLUDED  (no corrective signal) |

| Feedback        | Score |
|-----------------|-------|
| save_approved   | 1.00  |
| thumbs_up       | 0.70  |
| thumbs_down     | 0.20  |
| (none)          | 0.40  |

Composite: `cosine×0.65 + priority×0.35`

---

## Why This Is Not a Chatbot

- Each interaction is a structured form submission, not a message in a thread.
- There is no conversation history between coaching sessions.
- The rep fills in context (objection, service, personality) to get a precise result.
- Results are organized by section (response, strategy, avoid, close), not as prose.
- The system learns from outcomes and corrections — not from chat feedback loops.

---

## Future Modules (planned, not built)

| Module ID       | Purpose |
|-----------------|---------|
| pricingCoach    | Confidence scripts for price discussions and bundling |
| closingCoach    | Closing question generator by customer type |
| followUpCoach   | Follow-up call scripts based on prior interaction |
| callStrategy    | Pre-call planning: qualify fast, know your angles |
| playbooks       | Reusable team playbooks by scenario |
| analytics       | Win rates, objection frequency, coaching ROI |

Each future module will:
1. Get its own `run<Module>` function in `salesCoachEngine.js`
2. Be registered in `MODULE_HANDLERS`
3. Accept `POST /api/ai/sales-coach/module` with `module: '<moduleId>'`
4. Render in `SalesCoachPage` via the `MODULE_VIEWS` registry
