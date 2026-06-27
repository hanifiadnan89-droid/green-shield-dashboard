/**
 * Sales Intelligence — Knowledge Engine
 * =====================================
 *
 * Original coaching insights for Green Shield Pest Solutions field reps,
 * paraphrased from established sales psychology principles and adapted for
 * pest-control conversations. This is the source of truth for everything
 * the rep sees in the Sales Intelligence panel.
 *
 * ── Insight shape ────────────────────────────────────────────────────────
 *
 *   {
 *     id,            // string  — permanent stable identifier (never reuse)
 *     category,      // string  — human label for the badge ('Price Reframing')
 *     title,         // string  — short headline for the card
 *     line,          // string  — the words the rep actually says (1–3 sentences)
 *     whyItWorks,    // string  — 1–2 sentences on the underlying psychology
 *     psychology,    // string  — single short label ('Loss Aversion')
 *     tags,          // string[] — lowercase tags from the normalized taxonomy
 *
 *     // Optional ranking fields (defaults below if omitted)
 *     priority,      // 1–5 — how important this insight is generally  (def 3)
 *     confidence,    // 1–5 — how confident we are in the advice       (def 4)
 *     difficulty,    // 1–5 — how hard for a new rep to execute        (def 3)
 *     effectiveness, // 1–5 — how often it works in real conversations (def 4)
 *     curated,       // bool — admin-featured / always-on-rotation     (def false)
 *   }
 *
 * Telemetry fields (usageCount, feedbackScore, etc.) intentionally live
 * outside the static data — they belong in user profile / DB later.
 *
 * ── Tag taxonomy (37 tags) ───────────────────────────────────────────────
 *
 * Use only tags that already exist in INSIGHTS. To add a new tag, document
 * it here and use it in at least three insights so it carries weight.
 *
 *   Strategy / psychology:
 *     trust, authority, social, empathy, conviction, transparency,
 *     reciprocity, commitment, frame, anchor, scarcity, urgency
 *
 *   Sales motion:
 *     opening, discovery, value, price, closing, follow-up, appointment,
 *     decision, switching, relationship, consultative, differentiation,
 *     competitor
 *
 *   Outcome / risk:
 *     loss, risk, guarantee, prevention
 *
 *   Domain:
 *     residential, commercial, mosquito, rodents, bedbugs, generalpest,
 *     seasonal, annual
 *
 * ── Smart filtering by objection type ────────────────────────────────────
 *
 * When the rep selects an Objection Type in the form, the engine biases
 * the next insight toward a relevant tag pool. If filtering returns an
 * empty pool, the engine falls through to the full library.
 *
 * ── Rotation model (variety) ─────────────────────────────────────────────
 *
 *   1. Hard-exclude the last N IDs (no repeats inside the recency window).
 *   2. Soft-penalize the last few categories so 3 in a row from the same
 *      category is unlikely.
 *   3. Soft-penalize the last few psychology labels so the same technique
 *      doesn't appear back-to-back.
 *   4. Score each candidate (priority × confidence × curated boost ÷
 *      recency penalties) and pick weighted-random from the top slice —
 *      so the experience feels intelligent, not random.
 *
 * Recent IDs / categories / psychologies are persisted to localStorage so
 * variety carries across reloads.
 *
 * ── Future migration ─────────────────────────────────────────────────────
 *
 * The public API hides where data lives. Today INSIGHTS is an inline
 * array. Tomorrow it could be:
 *   - hydrated from a JSON CDN (replace the array with a fetch + cache)
 *   - hydrated from Supabase / Postgres (replace with a remote loader)
 *   - hydrated partially from an AI generator (concat generated entries
 *     onto the static list before building indexes)
 * Callers using pickInsight / searchInsights / getRelatedInsights / etc.
 * don't need to change.
 *
 * ── Personalization (future) ─────────────────────────────────────────────
 *
 * Every pick / list / search method accepts an optional `profile`:
 *   {
 *     skillLevel?,         // 'new' | 'intermediate' | 'experienced'
 *     preferredCategories?, // string[]
 *     hiddenCategories?,    // string[]
 *     hiddenIds?,           // string[]
 *     bookmarks?,           // string[]
 *     ratings?,             // { [id]: 'up' | 'down' }
 *   }
 * The engine uses what's provided and ignores the rest, so callers can
 * adopt fields incrementally.
 *
 * ── Adding insights ──────────────────────────────────────────────────────
 *
 *   1. Append inside INSIGHTS with a fresh stable id (see prefixes in use).
 *   2. Reuse an existing tag whenever it fits. Only invent a new tag if it
 *      will appear in three or more entries.
 *   3. Keep `line` to 1–3 sentences. Keep `whyItWorks` to 1–2.
 *   4. Don't reuse an id — even for replacements. Bump the suffix.
 *   5. Run `getStats()` after to confirm category counts feel balanced.
 */

// ──────────────────────────────────────────────────────────────────────────
//   Defaults applied to optional ranking fields
// ──────────────────────────────────────────────────────────────────────────

const DEFAULT_PRIORITY      = 3;
const DEFAULT_CONFIDENCE    = 4;
const DEFAULT_DIFFICULTY    = 3;
const DEFAULT_EFFECTIVENESS = 4;
const CURATED_BOOST         = 1.45;

// ──────────────────────────────────────────────────────────────────────────
//   Tag-routing for smart filtering by the rep's selected objection type
// ──────────────────────────────────────────────────────────────────────────

export const OBJECTION_TAG_MAP = {
  price:      ['price', 'value', 'frame', 'anchor', 'closing'],
  timing:     ['urgency', 'scarcity', 'commitment', 'decision', 'closing'],
  need:       ['discovery', 'value', 'risk', 'prevention'],
  trust:      ['trust', 'authority', 'transparency', 'guarantee', 'social', 'empathy'],
  competitor: ['competitor', 'differentiation', 'switching', 'value', 'relationship'],
  think:      ['decision', 'risk', 'urgency', 'closing', 'frame', 'commitment'],
};

// ──────────────────────────────────────────────────────────────────────────
//   Insights
// ──────────────────────────────────────────────────────────────────────────

export const INSIGHTS = [
  // ── PRICE REFRAMING ─────────────────────────────────────────────────────
  { id: 'price_001', category: 'Price Reframing', title: 'Break monthly cost into daily cost',
    line: "When you break it down, that's about two dollars a day to keep your home protected year-round.",
    whyItWorks: "Customers naturally compare small daily purchases instead of larger monthly commitments. The price stops being a decision and becomes a coffee.",
    psychology: 'Price Reframing', tags: ['price', 'value', 'frame', 'residential'], curated: true  },
  { id: 'price_002', category: 'Price Reframing', title: 'Cost per visit, not cost per month',
    line: "You're paying for four full property treatments a year — that works out to about a hundred and fifty per visit, which is less than most one-off calls.",
    whyItWorks: "Anchoring to a single-visit comparison surfaces the bundled value that the monthly number hides.",
    psychology: 'Anchoring', tags: ['price', 'value', 'anchor', 'frame'] },
  { id: 'price_003', category: 'Price Reframing', title: 'Reframe price against the alternative',
    line: "One carpenter ant treatment usually costs far more than preventing the problem in the first place.",
    whyItWorks: "Reframing price against the cost of inaction makes prevention feel like the cheaper option.",
    psychology: 'Loss Aversion', tags: ['price', 'value', 'prevention', 'loss', 'risk'] },
  { id: 'price_004', category: 'Price Reframing', title: 'Cost of a single rodent issue',
    line: "A single rodent chewing through wiring can cost thousands. The plan is a fraction of that — and it prevents the call in the first place.",
    whyItWorks: "Concrete damage scenarios beat abstract numbers. The customer sees prevention as insurance, not expense.",
    psychology: 'Loss Aversion', tags: ['price', 'risk', 'rodents', 'prevention', 'value'] },
  { id: 'price_005', category: 'Price Reframing', title: 'Compare to a streaming subscription',
    line: "Most families spend more on streaming services every month than they would on year-round pest protection.",
    whyItWorks: "A familiar reference point makes a new expense feel small and reasonable.",
    psychology: 'Reframing', tags: ['price', 'frame', 'residential', 'value'] },
  { id: 'price_006', category: 'Price Reframing', title: 'Cost per square foot',
    line: "On a property your size, that works out to pennies per square foot of protected area each month.",
    whyItWorks: "Granular per-unit pricing shrinks perceived cost while reinforcing the scope of coverage.",
    psychology: 'Anchoring', tags: ['price', 'anchor', 'frame', 'commercial', 'residential'] },
  { id: 'price_007', category: 'Price Reframing', title: 'Annual frame, not monthly',
    line: "Across a full year, you're investing less than most homeowners spend on a single landscaping visit.",
    whyItWorks: "An annual comparison feels manageable and lines up with how customers think about home upkeep.",
    psychology: 'Reframing', tags: ['price', 'annual', 'frame', 'residential'] },
  { id: 'price_008', category: 'Price Reframing', title: 'Price vs. cost',
    line: "I hear you on the price. Let me show you what the actual cost looks like if we don't address this.",
    whyItWorks: "Separating price (what you pay) from cost (what it costs you not to act) opens up a value conversation.",
    psychology: 'Loss Aversion', tags: ['price', 'value', 'frame', 'discovery'] },
  { id: 'price_009', category: 'Price Reframing', title: 'Reframe a per-visit charge',
    line: "Most people compare us to single-visit pricing — but you're getting recurring visits, monitoring, and free re-services included.",
    whyItWorks: "Highlights that the bundled service replaces multiple discrete purchases the customer already expects to make.",
    psychology: 'Value Stacking', tags: ['price', 'value', 'guarantee', 'differentiation'] },
  { id: 'price_010', category: 'Price Reframing', title: 'Investment, not expense',
    line: "I think of this less as an expense and more as protecting an investment you've already made — your home.",
    whyItWorks: "Reframing pest control as protecting an existing asset shifts the mental category from cost to insurance.",
    psychology: 'Framing', tags: ['price', 'frame', 'value', 'residential'] },
  { id: 'price_011', category: 'Price Reframing', title: 'Price-as-quality signal',
    line: "Our pricing reflects what's actually included — licensed techs, full warranty, monthly monitoring. The cheapest option usually means somebody is cutting corners.",
    whyItWorks: "Calls out price-cutting as a quality risk and reframes Green Shield's price as a quality signal.",
    psychology: 'Authority', tags: ['price', 'authority', 'trust', 'differentiation'] },
  { id: 'price_012', category: 'Price Reframing', title: 'Reframe a yearly bill',
    line: "If we put the annual cost on a single line item next to your other home expenses, it's almost always the smallest one.",
    whyItWorks: "Comparing to bigger, accepted line items shrinks the number in the customer's mental ledger.",
    psychology: 'Anchoring', tags: ['price', 'anchor', 'frame', 'annual'] },
  { id: 'price_013', category: 'Price Reframing', title: 'Per-day under a dollar comparison',
    line: "We're looking at well under a dollar a day for prevention — that's less than a vending machine snack.",
    whyItWorks: "Pairing a familiar low-stakes comparison makes the commitment feel almost trivial.",
    psychology: 'Reframing', tags: ['price', 'frame', 'value', 'residential'] },
  { id: 'price_014', category: 'Price Reframing', title: 'Cost of inaction is the real number',
    line: "The number you should actually compare this to is the cost of cleaning up an infestation after it happens.",
    whyItWorks: "Anchors the conversation to a worse, larger number so the actual plan feels reasonable.",
    psychology: 'Anchoring', tags: ['price', 'anchor', 'loss', 'prevention'] },
  { id: 'price_015', category: 'Price Reframing', title: 'Bundle math',
    line: "If you priced each visit, the warranty, and the monitoring separately, you'd be at almost double what the plan costs.",
    whyItWorks: "Breaks the bundled price into components, then shows the customer they're getting a discount.",
    psychology: 'Value Stacking', tags: ['price', 'value', 'frame', 'guarantee'] },

  // ── LOSS AVERSION ───────────────────────────────────────────────────────
  { id: 'loss_001', category: 'Loss Aversion', title: 'Frame around what they could lose',
    line: "The question isn't whether pests will come back. It's whether you'll already be protected when they do.",
    whyItWorks: "People are roughly twice as motivated to avoid a loss as they are to pursue an equivalent gain.",
    psychology: 'Loss Aversion', tags: ['loss', 'risk', 'prevention', 'closing'], curated: true  },
  { id: 'loss_002', category: 'Loss Aversion', title: 'Cost of one missed visit',
    line: "Most infestations we treat started as a small issue someone decided to wait on.",
    whyItWorks: "Tells the rep's story of regret without preaching. Customers fill in their own outcome.",
    psychology: 'Loss Aversion', tags: ['loss', 'risk', 'prevention', 'urgency'] },
  { id: 'loss_003', category: 'Loss Aversion', title: 'Damage they can\'t reverse',
    line: "Once carpenter ants get into the structure, we can stop them — but we can't undo the damage they've already done.",
    whyItWorks: "Highlights irreversible loss, which weighs heavier than reversible costs.",
    psychology: 'Loss Aversion', tags: ['loss', 'risk', 'prevention'] },
  { id: 'loss_004', category: 'Loss Aversion', title: 'Health risk frame',
    line: "Mice and rats don't just cause damage — they carry diseases that can spread quickly through a home.",
    whyItWorks: "Adds a non-financial loss (family health) that's hard to put a price on.",
    psychology: 'Loss Aversion', tags: ['loss', 'risk', 'rodents', 'residential'] },
  { id: 'loss_005', category: 'Loss Aversion', title: 'Property value frame',
    line: "If you ever sell this home, an active pest issue is one of the fastest ways to lose a buyer at inspection.",
    whyItWorks: "Reframes prevention as protecting a major future transaction.",
    psychology: 'Loss Aversion', tags: ['loss', 'risk', 'residential', 'prevention'] },
  { id: 'loss_006', category: 'Loss Aversion', title: 'Cost of one wasp call',
    line: "A single emergency wasp call can run more than three months of the plan.",
    whyItWorks: "Concrete comparison: the plan costs less than the alternative they'll be forced into anyway.",
    psychology: 'Anchoring', tags: ['loss', 'price', 'urgency', 'value'] },
  { id: 'loss_007', category: 'Loss Aversion', title: 'Pest reputation risk (commercial)',
    line: "For a business, one customer seeing a mouse can do more damage than the cost of a year of prevention.",
    whyItWorks: "Loss isn't just financial — it's reputational. That risk feels larger than the monthly invoice.",
    psychology: 'Loss Aversion', tags: ['loss', 'commercial', 'risk', 'prevention'] },
  { id: 'loss_008', category: 'Loss Aversion', title: 'Loss of summer outdoors',
    line: "The real cost of skipping mosquito treatment isn't dollars — it's losing the months you actually wanted to be outside.",
    whyItWorks: "Translates the loss from money to lived experience, which is harder to discount.",
    psychology: 'Loss Aversion', tags: ['loss', 'mosquito', 'seasonal', 'residential'] },
  { id: 'loss_009', category: 'Loss Aversion', title: 'Sunk cost of past treatments',
    line: "If you've already paid for one-off treatments before, you've spent more reacting than you would have on prevention.",
    whyItWorks: "Reframes past spend as evidence that the current approach is more expensive, not less.",
    psychology: 'Sunk Cost Framing', tags: ['loss', 'price', 'frame', 'prevention'] },
  { id: 'loss_010', category: 'Loss Aversion', title: 'Risk to pets',
    line: "Some of the products homeowners buy at the hardware store actually pose more risk to pets than the issue they're trying to solve.",
    whyItWorks: "Surfaces an unconsidered risk (pets) that increases motivation to use professionals.",
    psychology: 'Loss Aversion', tags: ['loss', 'risk', 'residential', 'authority', 'trust'] },
  { id: 'loss_011', category: 'Loss Aversion', title: 'Tick / Lyme risk',
    line: "One untreated tick season is all it takes for someone in the family to deal with Lyme — and that's a problem you can't put back in the box.",
    whyItWorks: "Concrete health risk reframes monthly cost as cheap insurance.",
    psychology: 'Loss Aversion', tags: ['loss', 'risk', 'mosquito', 'residential'] },
  { id: 'loss_012', category: 'Loss Aversion', title: 'Default state framing',
    line: "Untreated, the property is sitting in the default condition pests prefer. Treatment just shifts the default.",
    whyItWorks: "Frames inaction as actively choosing a worse outcome, not as neutral.",
    psychology: 'Framing', tags: ['loss', 'frame', 'prevention'] },

  // ── VALUE SELLING ───────────────────────────────────────────────────────
  { id: 'value_001', category: 'Value Selling', title: 'Stack the included services',
    line: "What you're getting is four full treatments, free re-services if anything pops up between visits, monthly monitoring, and a licensed tech every time.",
    whyItWorks: "Listing each included element separately makes the bundled value impossible to ignore.",
    psychology: 'Value Stacking', tags: ['value', 'guarantee', 'differentiation'] },
  { id: 'value_002', category: 'Value Selling', title: 'Outcome over service',
    line: "Most people don't actually want pest control. They want to not think about pests at all. That's what the plan does.",
    whyItWorks: "Sells the outcome, not the service. Customers pay more for the result they actually care about.",
    psychology: 'Outcome Selling', tags: ['value', 'frame', 'discovery'] },
  { id: 'value_003', category: 'Value Selling', title: 'Time savings',
    line: "Every hour you spend chasing pests on the property is time you'd rather spend doing something else.",
    whyItWorks: "Translates the service into time, which most homeowners value more than money.",
    psychology: 'Value Selling', tags: ['value', 'frame', 'residential'] },
  { id: 'value_004', category: 'Value Selling', title: 'Peace-of-mind frame',
    line: "What you're really buying is the ability to stop checking corners and listening for sounds in the wall.",
    whyItWorks: "Names the emotional outcome the customer already wants. It's hard to argue against.",
    psychology: 'Outcome Selling', tags: ['value', 'empathy', 'residential'], curated: true  },
  { id: 'value_005', category: 'Value Selling', title: 'Quality vs. cheapest',
    line: "There's always going to be someone cheaper. The question is whether you want it done once or done right.",
    whyItWorks: "Reframes the choice from price to quality. Most homeowners don't actually want the cheapest.",
    psychology: 'Quality Anchoring', tags: ['value', 'price', 'differentiation', 'authority'] },
  { id: 'value_006', category: 'Value Selling', title: 'Convenience of recurring',
    line: "You'll never have to remember to book a visit or chase down a quote — we handle the schedule, you don't think about it.",
    whyItWorks: "Convenience is its own value. Removing mental load is a real benefit.",
    psychology: 'Convenience Frame', tags: ['value', 'relationship', 'residential'] },
  { id: 'value_007', category: 'Value Selling', title: 'Local tech, not a call center',
    line: "You'll have the same tech most visits. They'll know your property — that's not something a one-off call gets you.",
    whyItWorks: "Personal continuity is a hard-to-copy differentiator.",
    psychology: 'Relationship Selling', tags: ['value', 'trust', 'relationship', 'differentiation'] },
  { id: 'value_008', category: 'Value Selling', title: 'Re-service guarantee',
    line: "If anything comes back between scheduled visits, we come back at no charge. That removes the gamble entirely.",
    whyItWorks: "Risk reversal — shifts the cost of a wrong outcome from the customer to Green Shield.",
    psychology: 'Risk Reversal', tags: ['value', 'guarantee', 'risk', 'trust'] },
  { id: 'value_009', category: 'Value Selling', title: 'Family- and pet-friendly',
    line: "Everything we use is family- and pet-friendly once it dries — usually about thirty minutes.",
    whyItWorks: "Removes a hidden objection (safety) before the customer raises it.",
    psychology: 'Pre-empting Objections', tags: ['value', 'trust', 'residential', 'authority'] },
  { id: 'value_010', category: 'Value Selling', title: 'Total cost of ownership',
    line: "Compare the plan against everything you'd spend on one-off treatments, hardware-store products, and your own time. The plan usually wins.",
    whyItWorks: "Total cost of ownership shows the alternative is more expensive than it looks.",
    psychology: 'Value Stacking', tags: ['value', 'price', 'frame'] },
  { id: 'value_011', category: 'Value Selling', title: 'Same product, different stakes',
    line: "Anybody can spray. What you're paying for is somebody who knows where to spray, what to use, and what to watch for.",
    whyItWorks: "Reframes the service as expertise, not labor — which justifies the price.",
    psychology: 'Authority', tags: ['value', 'authority', 'trust', 'differentiation'] },
  { id: 'value_012', category: 'Value Selling', title: 'Year-round vs. one-time',
    line: "A one-time visit fixes today. A plan keeps tomorrow from becoming a problem.",
    whyItWorks: "Time-horizon framing makes the recurring model feel inherently more valuable.",
    psychology: 'Outcome Selling', tags: ['value', 'prevention', 'closing', 'annual'] },
  { id: 'value_013', category: 'Value Selling', title: 'Custom plan, not a script',
    line: "We don't run a fixed playbook. The plan adjusts to what we actually find on your property, season by season.",
    whyItWorks: "Personalization signals genuine expertise and pushes back on commodity pricing.",
    psychology: 'Differentiation', tags: ['value', 'differentiation', 'authority', 'consultative'] },
  { id: 'value_014', category: 'Value Selling', title: 'Specialist vs. generalist',
    line: "A handyman can spray. We can tell you why the issue is happening, where it'll happen next, and how to stop it.",
    whyItWorks: "Expertise-based differentiation is one of the strongest defenses against price-shopping.",
    psychology: 'Authority', tags: ['value', 'authority', 'differentiation', 'consultative'] },
  { id: 'value_015', category: 'Value Selling', title: 'Future-proofing the home',
    line: "Every visit isn't just about today — we're building a record of the property so issues get caught earlier each season.",
    whyItWorks: "Frames recurring service as an ongoing investment with compounding value.",
    psychology: 'Value Stacking', tags: ['value', 'prevention', 'annual', 'consultative'] },

  // ── RISK REVERSAL ───────────────────────────────────────────────────────
  { id: 'risk_001', category: 'Risk Reversal', title: 'Re-service guarantee front and center',
    line: "If pests come back between visits, we come back at no charge. The financial risk of being wrong is on us, not you.",
    whyItWorks: "Risk reversal removes the customer's downside, which is usually the actual blocker.",
    psychology: 'Risk Reversal', tags: ['risk', 'guarantee', 'trust', 'closing'], curated: true  },
  { id: 'risk_002', category: 'Risk Reversal', title: 'No long-term contract',
    line: "There's no long-term lock-in. If we're not delivering, you can stop at any time.",
    whyItWorks: "Removing the worst-case scenario makes saying yes feel low-stakes.",
    psychology: 'Risk Reversal', tags: ['risk', 'guarantee', 'trust', 'commitment'] },
  { id: 'risk_003', category: 'Risk Reversal', title: 'Try the first visit',
    line: "Most people make their mind up after the first visit. If you don't see what we mean by then, we stop.",
    whyItWorks: "Shrinks the decision to a single low-risk step. Easier to say yes to one visit than a whole year.",
    psychology: 'Foot in the Door', tags: ['risk', 'commitment', 'closing'] },
  { id: 'risk_004', category: 'Risk Reversal', title: 'Free initial inspection',
    line: "The initial inspection is on us. You'll know exactly what's happening on the property before you decide anything.",
    whyItWorks: "Reduces upfront risk to zero, which lowers the activation energy to engage.",
    psychology: 'Reciprocity', tags: ['risk', 'reciprocity', 'discovery', 'opening'] },
  { id: 'risk_005', category: 'Risk Reversal', title: 'No-pressure framing',
    line: "I'm not here to talk you into anything. If after the walk-through you'd rather hold off, that's a clear answer too.",
    whyItWorks: "Lowering perceived pressure builds trust and ironically raises close rate.",
    psychology: 'Reverse Psychology', tags: ['risk', 'trust', 'empathy', 'closing'] },
  { id: 'risk_006', category: 'Risk Reversal', title: 'Guarantee in writing',
    line: "Everything I just said is on the agreement in writing — the re-service, the cancellation, the warranty. Nothing is verbal.",
    whyItWorks: "Putting guarantees in writing converts trust from emotional to contractual.",
    psychology: 'Authority', tags: ['risk', 'guarantee', 'authority', 'trust'] },
  { id: 'risk_007', category: 'Risk Reversal', title: 'You can downgrade',
    line: "If anything changes during the year, we can scale the plan down — you're not locked into the full version forever.",
    whyItWorks: "Flexibility lowers the perceived cost of being wrong.",
    psychology: 'Risk Reversal', tags: ['risk', 'guarantee', 'commitment'] },
  { id: 'risk_008', category: 'Risk Reversal', title: 'Match before you switch',
    line: "Before you switch from your current provider, take the inspection and compare side by side. If we're not better, stay where you are.",
    whyItWorks: "Lowers the bar from buying to comparing — much easier yes.",
    psychology: 'Comparison Anchoring', tags: ['risk', 'competitor', 'switching', 'discovery'] },
  { id: 'risk_009', category: 'Risk Reversal', title: 'Skip a month policy',
    line: "If you ever need to skip a treatment because of an event or schedule, we'll work around it. The plan doesn't penalize life.",
    whyItWorks: "Pre-empts the 'what if something changes' worry.",
    psychology: 'Risk Reversal', tags: ['risk', 'guarantee', 'commitment'] },
  { id: 'risk_010', category: 'Risk Reversal', title: 'Local accountability',
    line: "We're a local operation. If something isn't right, you're not calling a 1-800 number — you're calling us directly.",
    whyItWorks: "Local accountability is a non-replicable trust signal vs. national franchises.",
    psychology: 'Trust', tags: ['risk', 'trust', 'differentiation', 'relationship'] },

  // ── TRUST BUILDING ──────────────────────────────────────────────────────
  { id: 'trust_001', category: 'Trust', title: 'Lead with what you won\'t do',
    line: "My goal isn't to sell you something you don't need. It's to make sure you never have to deal with this problem again.",
    whyItWorks: "Stating what you won't do reduces perceived sales pressure and increases credibility.",
    psychology: 'Reverse Psychology', tags: ['trust', 'empathy', 'opening'], curated: true  },
  { id: 'trust_002', category: 'Trust', title: 'Disqualify openly',
    line: "If a one-time visit is genuinely what you need, I'll be the first to tell you — no point sliding into a plan.",
    whyItWorks: "Disqualification builds trust faster than enthusiasm. It signals you're not desperate.",
    psychology: 'Reverse Psychology', tags: ['trust', 'transparency', 'authority'] },
  { id: 'trust_003', category: 'Trust', title: 'Show, don\'t tell',
    line: "Before we talk about plans — let me show you what I'm actually seeing on the property.",
    whyItWorks: "Evidence-first conversations earn the right to propose a solution.",
    psychology: 'Consultative Selling', tags: ['trust', 'discovery', 'authority', 'consultative'] },
  { id: 'trust_004', category: 'Trust', title: 'Acknowledge bad experiences',
    line: "I get it — a lot of homeowners have had a pest company show up, spray, and disappear. That's not how this works.",
    whyItWorks: "Validating past skepticism beats arguing against it.",
    psychology: 'Empathy', tags: ['trust', 'empathy', 'differentiation'] },
  { id: 'trust_005', category: 'Trust', title: 'Use specifics, not slogans',
    line: "We've been treating properties in this neighborhood for years. I can show you addresses if it helps.",
    whyItWorks: "Specific local details signal real presence — generic claims don't.",
    psychology: 'Social Proof', tags: ['trust', 'social', 'authority', 'differentiation'] },
  { id: 'trust_006', category: 'Trust', title: 'Name the worst case',
    line: "Worst case, we treat once and don't see the issue again — and you still have us in your phone if anything changes.",
    whyItWorks: "Surfacing the worst case neutralizes the customer's fear of being trapped.",
    psychology: 'Risk Reversal', tags: ['trust', 'risk', 'guarantee'] },
  { id: 'trust_007', category: 'Trust', title: 'Slow down on jargon',
    line: "I don't want to throw technical names at you. The short version is: here's what we'd do, and here's why.",
    whyItWorks: "Plain language signals you're more interested in understanding than impressing.",
    psychology: 'Consultative Selling', tags: ['trust', 'empathy', 'consultative'] },
  { id: 'trust_008', category: 'Trust', title: 'Same tech every visit',
    line: "You'll see the same tech most visits. They'll learn your property — that consistency is part of why this works.",
    whyItWorks: "Personal continuity is a hard-to-fake trust signal.",
    psychology: 'Relationship Selling', tags: ['trust', 'relationship', 'differentiation'] },
  { id: 'trust_009', category: 'Trust', title: 'Tell them what to expect',
    line: "Before I leave today, I'll tell you exactly what the next visit will look like and what we're watching for. No surprises.",
    whyItWorks: "Predictability builds trust. Sales people who tell you what's coming feel less like sales people.",
    psychology: 'Transparency', tags: ['trust', 'transparency', 'consultative'] },
  { id: 'trust_010', category: 'Trust', title: 'Cite the warranty',
    line: "The warranty is on the agreement. You don't need to take my word for what I said — read the page, that's the actual commitment.",
    whyItWorks: "Pointing to the written agreement signals you have nothing to hide.",
    psychology: 'Authority', tags: ['trust', 'transparency', 'guarantee', 'authority'] },
  { id: 'trust_011', category: 'Trust', title: 'Refer them away when warranted',
    line: "Honestly, what you're describing sounds more like a wildlife issue than a pest one. We're not the right company for that — let me give you a name.",
    whyItWorks: "Referring out builds enormous credibility and keeps the door open for the right job.",
    psychology: 'Reverse Psychology', tags: ['trust', 'authority', 'transparency'] },
  { id: 'trust_012', category: 'Trust', title: 'Local presence beats national',
    line: "We live here. We treat homes on this street. If we screw something up, we hear about it the next day.",
    whyItWorks: "Local accountability is a trust signal national chains can't replicate.",
    psychology: 'Relationship Selling', tags: ['trust', 'relationship', 'differentiation', 'authority'] },
  { id: 'trust_013', category: 'Trust', title: 'Quote a real number',
    line: "On a property your size, expect somewhere in our typical mid-range. I'd rather give you the honest range now than guess high to hedge.",
    whyItWorks: "Specific ranges signal honesty. Vague answers signal you're hiding something.",
    psychology: 'Transparency', tags: ['trust', 'transparency', 'price'] },
  { id: 'trust_014', category: 'Trust', title: 'Trade short-term for long-term',
    line: "I'd rather you say no today and be a customer in two years than feel pushed and never call us again.",
    whyItWorks: "Long-time horizon framing positions the rep as a partner, not a salesperson.",
    psychology: 'Relationship Selling', tags: ['trust', 'relationship', 'empathy'] },
  { id: 'trust_015', category: 'Trust', title: 'Admit limitations',
    line: "There are a couple things I can't promise — like a one-hundred-percent guarantee on wildlife — and I'd rather be upfront about that.",
    whyItWorks: "Admitting limits paradoxically makes every other claim more believable.",
    psychology: 'Transparency', tags: ['trust', 'transparency', 'authority'] },

  // ── AUTHORITY ───────────────────────────────────────────────────────────
  { id: 'auth_001', category: 'Authority', title: 'Speak in specifics',
    line: "What you're describing is almost certainly a moisture-driven carpenter ant issue. We see the same pattern in homes built in the 80s around here.",
    whyItWorks: "Specific diagnostic claims demonstrate expertise. Generic statements don't.",
    psychology: 'Authority', tags: ['authority', 'consultative', 'discovery'] },
  { id: 'auth_002', category: 'Authority', title: 'Reference the season',
    line: "This time of year, we typically see the activity pick up about three weeks from now. Treating now means you're ahead of it.",
    whyItWorks: "Seasonal knowledge demonstrates real field expertise and creates urgency.",
    psychology: 'Authority', tags: ['authority', 'urgency', 'seasonal', 'closing'] },
  { id: 'auth_003', category: 'Authority', title: 'Tell them what hardware-store products miss',
    line: "Hardware-store sprays kill what you see. They don't touch the colony you don't see — that's the part the issue actually comes from.",
    whyItWorks: "Showing what amateurs miss positions professional service as essential, not optional.",
    psychology: 'Authority', tags: ['authority', 'differentiation', 'value'] },
  { id: 'auth_004', category: 'Authority', title: 'Cite the science casually',
    line: "Ant trails work on pheromone — when you spray a single ant, you're scattering the trail, not solving it.",
    whyItWorks: "Light biology references signal expertise without lecturing.",
    psychology: 'Authority', tags: ['authority', 'consultative', 'differentiation'] },
  { id: 'auth_005', category: 'Authority', title: 'Predict what will happen',
    line: "In about two weeks, you'll probably start noticing more activity in the kitchen first. That's the cycle we're trying to interrupt.",
    whyItWorks: "Confident future predictions, when accurate, establish authority faster than any credential.",
    psychology: 'Authority', tags: ['authority', 'urgency', 'discovery'] },
  { id: 'auth_006', category: 'Authority', title: 'Diagnose before prescribing',
    line: "Let me walk the property first. I don't want to tell you what you need before I've looked.",
    whyItWorks: "Doctors diagnose before prescribing. Sales people don't. The contrast builds authority.",
    psychology: 'Consultative Selling', tags: ['authority', 'consultative', 'discovery'] },
  { id: 'auth_007', category: 'Authority', title: 'Use case-based language',
    line: "About eight out of ten properties in this neighborhood show some level of mouse activity by November. It's not just you.",
    whyItWorks: "Statistical framing positions the rep as a category expert.",
    psychology: 'Authority', tags: ['authority', 'social', 'discovery'] },
  { id: 'auth_008', category: 'Authority', title: 'Tell them the version you don\'t do',
    line: "We don't bait near food prep areas — we use a different technique that's safer for kitchens.",
    whyItWorks: "Showing nuance and judgment differentiates from companies that follow scripts.",
    psychology: 'Authority', tags: ['authority', 'differentiation', 'trust'] },
  { id: 'auth_009', category: 'Authority', title: 'Use a confident verdict',
    line: "Based on what I'm seeing, you have a low-grade issue that will become a real one by midsummer if it's not interrupted.",
    whyItWorks: "Confident diagnoses establish that the rep is the expert in the room.",
    psychology: 'Authority', tags: ['authority', 'urgency', 'discovery'] },
  { id: 'auth_010', category: 'Authority', title: 'Anchor to your reps\' experience',
    line: "Our techs treat thousands of properties a year. We see patterns across the whole region — not just yours.",
    whyItWorks: "Aggregate experience is its own credential.",
    psychology: 'Authority', tags: ['authority', 'social', 'differentiation'] },

  // ── SOCIAL PROOF ────────────────────────────────────────────────────────
  { id: 'social_001', category: 'Social Proof', title: 'Reference neighbors',
    line: "Most homeowners on this street choose year-round protection because preventing infestations is almost always less expensive than treating them.",
    whyItWorks: "People trust decisions that others similar to them have already made.",
    psychology: 'Social Proof', tags: ['social', 'closing', 'residential'], curated: true  },
  { id: 'social_002', category: 'Social Proof', title: 'Local case naming',
    line: "We treat a lot of homes in this zip code. The same patterns we see at your place, we've solved next door.",
    whyItWorks: "Geographic specificity makes social proof concrete and harder to dismiss.",
    psychology: 'Social Proof', tags: ['social', 'authority', 'residential'] },
  { id: 'social_003', category: 'Social Proof', title: 'Most-chosen plan',
    line: "Quarterly is the plan most of our families settle on — it gives the best coverage without overdoing it.",
    whyItWorks: "'Most-chosen' framing nudges toward the option without applying pressure.",
    psychology: 'Social Proof', tags: ['social', 'closing', 'residential'] },
  { id: 'social_004', category: 'Social Proof', title: 'Story of a similar customer',
    line: "Last week I was at a house just like yours — same age, same setup. The issue we found there is the same one I'd be watching for here.",
    whyItWorks: "Similar-customer stories activate identification and reduce 'that won't happen to me' bias.",
    psychology: 'Social Proof', tags: ['social', 'discovery', 'residential'] },
  { id: 'social_005', category: 'Social Proof', title: 'Retention as proof',
    line: "Most of our families stay with us for years. If we weren't doing the job, that wouldn't be the case.",
    whyItWorks: "Retention is a strong, hard-to-fake credibility signal.",
    psychology: 'Social Proof', tags: ['social', 'trust', 'differentiation'] },
  { id: 'social_006', category: 'Social Proof', title: 'Referral pattern',
    line: "Most new families come to us from a neighbor. That's not us spending on ads — it's homeowners telling other homeowners.",
    whyItWorks: "Referral-driven growth is a credibility signal that no marketing can fake.",
    psychology: 'Social Proof', tags: ['social', 'trust', 'differentiation'] },
  { id: 'social_007', category: 'Social Proof', title: 'Commercial proof case',
    line: "We handle pest control for a handful of restaurants in town. Health inspectors hold them to a tough standard — and so do we.",
    whyItWorks: "Commercial clients with strict standards validate the residential service implicitly.",
    psychology: 'Social Proof', tags: ['social', 'commercial', 'authority'] },
  { id: 'social_008', category: 'Social Proof', title: 'Reviews on the spot',
    line: "If it helps, I can pull up a handful of recent reviews from properties around here right now.",
    whyItWorks: "On-demand evidence beats abstract claims. Most reps don't offer this — that's the point.",
    psychology: 'Social Proof', tags: ['social', 'trust', 'transparency'] },
  { id: 'social_009', category: 'Social Proof', title: 'Reasoned majority',
    line: "Nine out of ten homeowners who do an initial inspection end up keeping us. Not because we pressure — because the proof shows up in the property.",
    whyItWorks: "Pairs social proof with the underlying reason, making it more persuasive.",
    psychology: 'Social Proof', tags: ['social', 'closing', 'authority'] },
  { id: 'social_010', category: 'Social Proof', title: 'Property-manager validation',
    line: "We're the go-to for several property managers in town. They can't afford a bad call — that's how they choose vendors.",
    whyItWorks: "Professional buyers with high standards validate the work for residential prospects.",
    psychology: 'Social Proof', tags: ['social', 'commercial', 'authority'] },
  { id: 'social_011', category: 'Social Proof', title: 'Public commitment to neighbors',
    line: "If something went wrong on your property, you'd hear about it at the next block party. We don't take that lightly.",
    whyItWorks: "Social accountability frames the rep as personally invested, not transactional.",
    psychology: 'Relationship Selling', tags: ['social', 'relationship', 'trust'] },
  { id: 'social_012', category: 'Social Proof', title: 'Long-tenured techs',
    line: "Most of our techs have been with us a long time. In this industry, that's rare — and it shows up on every visit.",
    whyItWorks: "Internal proof: people only stay where the work is good.",
    psychology: 'Social Proof', tags: ['social', 'authority', 'differentiation'] },

  // ── EMPATHY ─────────────────────────────────────────────────────────────
  { id: 'empathy_001', category: 'Empathy', title: 'Name what they\'re feeling',
    line: "I get it — the last thing you want is somebody at the door pitching you on something that costs money you weren't planning to spend.",
    whyItWorks: "Naming the customer's actual mental state defuses defensiveness instantly.",
    psychology: 'Empathy', tags: ['empathy', 'opening', 'trust'], curated: true  },
  { id: 'empathy_002', category: 'Empathy', title: 'Acknowledge the unwelcome timing',
    line: "I know nobody plans for a pest issue — they always show up at the worst time.",
    whyItWorks: "Acknowledging the inconvenience builds rapport before pitching a fix.",
    psychology: 'Empathy', tags: ['empathy', 'discovery'] },
  { id: 'empathy_003', category: 'Empathy', title: 'Mirror the language',
    line: "When you say it's 'gross' — that's exactly what most of the families I work with say. You're not overreacting.",
    whyItWorks: "Mirroring the customer's words and validating the emotion builds connection.",
    psychology: 'Mirroring', tags: ['empathy', 'discovery', 'trust'] },
  { id: 'empathy_004', category: 'Empathy', title: 'Acknowledge a bad past experience',
    line: "Sounds like the last company you tried left you with a bad taste. I'd be skeptical too — let me show you how this is different.",
    whyItWorks: "Validating skepticism is more persuasive than arguing against it.",
    psychology: 'Empathy', tags: ['empathy', 'trust', 'differentiation'] },
  { id: 'empathy_005', category: 'Empathy', title: 'Empathize before educating',
    line: "Before I get into the technical side, I just want to say — this is a frustrating problem to deal with, and you shouldn't have to.",
    whyItWorks: "Emotion before logic. Customers buy from people who hear them first.",
    psychology: 'Empathy', tags: ['empathy', 'discovery', 'consultative'] },
  { id: 'empathy_006', category: 'Empathy', title: 'Acknowledge the kids/pets factor',
    line: "I have a couple kids at home myself. Anything I bring onto a property, I'd be comfortable with around my own family.",
    whyItWorks: "Personal alignment with the customer's situation creates instant trust.",
    psychology: 'Empathy', tags: ['empathy', 'trust', 'residential'] },
  { id: 'empathy_007', category: 'Empathy', title: 'Slow down the conversation',
    line: "Take your time. There's no clock on this — I want you to actually feel good about the decision.",
    whyItWorks: "Removing pressure paradoxically increases the customer's willingness to commit.",
    psychology: 'Empathy', tags: ['empathy', 'trust', 'closing'] },
  { id: 'empathy_008', category: 'Empathy', title: 'Acknowledge the cost concern openly',
    line: "Nobody loves another monthly expense — that's a real thing. I'd never tell you otherwise.",
    whyItWorks: "Acknowledging the objection openly disarms it. Denying it makes it bigger.",
    psychology: 'Empathy', tags: ['empathy', 'price', 'trust'] },
  { id: 'empathy_009', category: 'Empathy', title: 'Speak to the family, not just the buyer',
    line: "If your spouse wants to look at this with you, I can leave the details and come back tomorrow. This shouldn't feel rushed.",
    whyItWorks: "Inviting the absent decision-maker prevents 'I need to talk to my spouse' from becoming a dead end.",
    psychology: 'Empathy', tags: ['empathy', 'decision', 'closing'] },
  { id: 'empathy_010', category: 'Empathy', title: 'Validate the inconvenience of a sales visit',
    line: "I know you didn't plan on talking to a pest company today. I'll keep this quick.",
    whyItWorks: "Acknowledging the imposition lowers defensiveness and signals respect for the customer's time.",
    psychology: 'Empathy', tags: ['empathy', 'opening', 'trust'] },

  // ── CLOSING QUESTIONS ───────────────────────────────────────────────────
  { id: 'close_001', category: 'Closing Questions', title: 'The alternative-choice close',
    line: "Would next Tuesday or Thursday work better?",
    whyItWorks: "The customer starts choosing a date instead of deciding whether to move forward.",
    psychology: 'Alternative Choice Close', tags: ['closing', 'commitment', 'appointment'], curated: true  },
  { id: 'close_002', category: 'Closing Questions', title: 'The assumptive close',
    line: "I'll plan to be back out next week — does the morning or the afternoon work better for you?",
    whyItWorks: "Assumes the yes and moves immediately to logistics. Hard to push back on.",
    psychology: 'Assumptive Close', tags: ['closing', 'commitment', 'appointment'] },
  { id: 'close_003', category: 'Closing Questions', title: 'The summary close',
    line: "So to make sure I have this right — you want quarterly coverage, you want the re-service guarantee, and you'd like to start before mosquito season. Sound about right?",
    whyItWorks: "Re-stating what the customer wants makes the decision feel inevitable.",
    psychology: 'Commitment & Consistency', tags: ['closing', 'commitment', 'consultative'] },
  { id: 'close_004', category: 'Closing Questions', title: 'The single-objection close',
    line: "If we set aside the price for a second, is there anything else that would hold you back from saying yes today?",
    whyItWorks: "Isolates the real objection and prevents new ones from being invented.",
    psychology: 'Objection Isolation', tags: ['closing', 'discovery', 'price'] },
  { id: 'close_005', category: 'Closing Questions', title: 'The direct close',
    line: "If the plan solves the actual problem and fits the property, would you be comfortable moving forward today?",
    whyItWorks: "Direct, respectful, and gives the customer a clear yes/no path.",
    psychology: 'Direct Close', tags: ['closing', 'commitment'], curated: true  },
  { id: 'close_006', category: 'Closing Questions', title: 'The conditional close',
    line: "If I could include the initial inspection at no charge, would you be comfortable starting today?",
    whyItWorks: "Trades a small concession for a definite commitment.",
    psychology: 'Concession Close', tags: ['closing', 'reciprocity', 'commitment'] },
  { id: 'close_007', category: 'Closing Questions', title: 'The next-step close',
    line: "If we're a fit, the next step is just scheduling a first visit. Want me to set that up before I leave?",
    whyItWorks: "Reframes 'buying' as 'scheduling a visit' — much lower stakes.",
    psychology: 'Foot in the Door', tags: ['closing', 'commitment', 'appointment'] },
  { id: 'close_008', category: 'Closing Questions', title: 'The minor-yes close',
    line: "Does the quarterly cadence make sense for your property?",
    whyItWorks: "Builds momentum by getting easy yeses on small decisions before the big one.",
    psychology: 'Commitment & Consistency', tags: ['closing', 'commitment'] },
  { id: 'close_009', category: 'Closing Questions', title: 'Permission to close',
    line: "Is it fair if I ask what would need to be true for you to move forward today?",
    whyItWorks: "Permission-based questions feel respectful and surface the real blocker.",
    psychology: 'Consultative Close', tags: ['closing', 'discovery', 'empathy'] },
  { id: 'close_010', category: 'Closing Questions', title: 'The Ben Franklin close',
    line: "If it helps, let's list out what works and what doesn't on a piece of paper — sometimes seeing it makes the decision easier.",
    whyItWorks: "Pros/cons exercises typically favor the offer that's been thoroughly explained — the rep's.",
    psychology: 'Decision Framing', tags: ['closing', 'decision', 'consultative'] },
  { id: 'close_011', category: 'Closing Questions', title: 'The trial close',
    line: "How are you feeling about everything we've covered so far?",
    whyItWorks: "Surfaces concerns before they ossify into objections.",
    psychology: 'Trial Close', tags: ['closing', 'discovery', 'empathy'] },
  { id: 'close_012', category: 'Closing Questions', title: 'The lost-deal recovery close',
    line: "Totally understand if today's not the day. Would it help if I checked in toward the end of the month before the season changes?",
    whyItWorks: "Keeps the door open without pressure and creates a soft urgency anchor.",
    psychology: 'Follow-Up', tags: ['closing', 'urgency', 'follow-up'] },
  { id: 'close_013', category: 'Closing Questions', title: 'The price-locked close',
    line: "If we start today, the pricing is locked at this rate for the full year. If you wait, I can't promise that.",
    whyItWorks: "Combines urgency with a real concession to incentivize action now.",
    psychology: 'Scarcity', tags: ['closing', 'urgency', 'scarcity', 'price'] },
  { id: 'close_014', category: 'Closing Questions', title: 'The reverse close',
    line: "Is there any reason — even a small one — we shouldn't get this on the books today?",
    whyItWorks: "Asks for the no, which surfaces the real objection or leads to a yes.",
    psychology: 'Reverse Close', tags: ['closing', 'discovery', 'empathy'] },
  { id: 'close_015', category: 'Closing Questions', title: 'The recap-and-go close',
    line: "Quick recap: quarterly plan, re-service included, first visit next week. Want me to lock it in?",
    whyItWorks: "A tight summary plus a clear ask is one of the highest-converting close patterns.",
    psychology: 'Assumptive Close', tags: ['closing', 'commitment', 'appointment'] },
  { id: 'close_016', category: 'Closing Questions', title: 'The takeaway close',
    line: "Honestly, if you don't think it's a fit, that's a fine answer — better than committing to something that doesn't make sense.",
    whyItWorks: "Removing the offer triggers a small loss aversion that often reverses hesitation.",
    psychology: 'Reverse Psychology', tags: ['closing', 'loss', 'empathy'] },
  { id: 'close_017', category: 'Closing Questions', title: 'The puppy-dog close',
    line: "How about this — we'll do the first visit. If you don't see what I'm describing on the property, we stop there.",
    whyItWorks: "Lowers the decision to a single action with no downstream commitment.",
    psychology: 'Foot in the Door', tags: ['closing', 'risk', 'commitment'] },
  { id: 'close_018', category: 'Closing Questions', title: 'The closing question for spouses',
    line: "If we set this up tonight, would your spouse want to be on the call when the tech first arrives, or just hear about it after?",
    whyItWorks: "Smuggles the absent decision-maker into the scheduling discussion without losing momentum.",
    psychology: 'Assumptive Close', tags: ['closing', 'decision', 'commitment'] },

  // ── DISCOVERY QUESTIONS ─────────────────────────────────────────────────
  { id: 'disc_001', category: 'Discovery Questions', title: 'What\'s been happening?',
    line: "Tell me what you've been noticing on the property — when it started, where you see it, anything that's gotten worse.",
    whyItWorks: "Open-ended discovery questions surface the real problem and put the customer in storytelling mode.",
    psychology: 'Consultative Selling', tags: ['discovery', 'consultative', 'opening'], curated: true  },
  { id: 'disc_002', category: 'Discovery Questions', title: 'What have you tried?',
    line: "What have you tried so far, and what's worked or not worked?",
    whyItWorks: "Past failures justify the need for professional intervention without the rep saying it.",
    psychology: 'Discovery', tags: ['discovery', 'consultative'] },
  { id: 'disc_003', category: 'Discovery Questions', title: 'What\'s the actual outcome you want?',
    line: "If we fast-forward a year — what does the property look like for you to feel like this was solved?",
    whyItWorks: "Outcome-based questions move past symptoms and surface the real success criteria.",
    psychology: 'SPIN — Need-Payoff', tags: ['discovery', 'value', 'closing'] },
  { id: 'disc_004', category: 'Discovery Questions', title: 'Severity question',
    line: "On a scale of one to ten, how much is this bothering you right now?",
    whyItWorks: "Quantifies the problem and gives the customer a concrete reason to act.",
    psychology: 'SPIN — Implication', tags: ['discovery', 'urgency'] },
  { id: 'disc_005', category: 'Discovery Questions', title: 'Frequency question',
    line: "How often are you seeing this — daily, weekly, just every once in a while?",
    whyItWorks: "Frequency questions reveal whether the customer has a one-time or recurring issue, which steers the recommendation.",
    psychology: 'Discovery', tags: ['discovery', 'consultative'] },
  { id: 'disc_006', category: 'Discovery Questions', title: 'Impact question',
    line: "How is this affecting how you use the property? Are there rooms or parts of the yard you've stopped using?",
    whyItWorks: "Surfaces the lifestyle cost of inaction, which often matters more than the dollar cost.",
    psychology: 'SPIN — Implication', tags: ['discovery', 'value'] },
  { id: 'disc_007', category: 'Discovery Questions', title: 'Past spend question',
    line: "Have you spent money on this before? Roughly how much, and what did you get out of it?",
    whyItWorks: "Surfaces past spend that often exceeds the cost of a plan — and gives the rep a comparison anchor.",
    psychology: 'Anchoring', tags: ['discovery', 'price'] },
  { id: 'disc_008', category: 'Discovery Questions', title: 'Decision-maker question',
    line: "When it comes to decisions like this, is it just you, or is somebody else involved?",
    whyItWorks: "Surfaces hidden decision-makers early, preventing 'I need to talk to my spouse' from killing the close.",
    psychology: 'Discovery', tags: ['discovery', 'decision'] },
  { id: 'disc_009', category: 'Discovery Questions', title: 'Timeline question',
    line: "Is this something you'd want addressed before the season changes, or are you okay waiting?",
    whyItWorks: "Surfaces urgency the customer already has — instead of the rep trying to manufacture it.",
    psychology: 'Discovery', tags: ['discovery', 'urgency'] },
  { id: 'disc_010', category: 'Discovery Questions', title: 'Worst-case question',
    line: "If this gets worse before you do something about it, what does that look like for you?",
    whyItWorks: "The customer paints their own worst-case scenario, which is far more persuasive than the rep doing it.",
    psychology: 'SPIN — Implication', tags: ['discovery', 'loss'] },
  { id: 'disc_011', category: 'Discovery Questions', title: 'Best-case question',
    line: "What would the ideal outcome look like for you here?",
    whyItWorks: "Anchors the conversation to what the customer wants, not what the rep is selling.",
    psychology: 'Discovery', tags: ['discovery', 'value'] },
  { id: 'disc_012', category: 'Discovery Questions', title: 'Constraint question',
    line: "Is there anything I should know about — budget, schedule, anybody at home with allergies — that would shape what we do?",
    whyItWorks: "Surfaces constraints upfront so the proposal can be tailored to actually fit.",
    psychology: 'Consultative Selling', tags: ['discovery', 'consultative'] },
  { id: 'disc_013', category: 'Discovery Questions', title: 'Property-history question',
    line: "How long have you owned the home, and have there been pest issues before?",
    whyItWorks: "Property history surfaces patterns and indicates whether prevention or treatment is the priority.",
    psychology: 'Discovery', tags: ['discovery', 'residential'] },
  { id: 'disc_014', category: 'Discovery Questions', title: 'Neighbor question',
    line: "Have you noticed if your neighbors are dealing with the same thing? Pest issues rarely stop at the property line.",
    whyItWorks: "Frames the issue as systemic rather than personal, which lowers customer embarrassment.",
    psychology: 'Discovery', tags: ['discovery', 'social', 'residential'] },
  { id: 'disc_015', category: 'Discovery Questions', title: 'Trigger question',
    line: "What made today the day you decided to actually do something about this?",
    whyItWorks: "Surfaces the emotional trigger that motivated the call — which the rep can echo at close.",
    psychology: 'Discovery', tags: ['discovery', 'closing'] },

  // ── OBJECTION: TOO EXPENSIVE ────────────────────────────────────────────
  { id: 'obj_price_001', category: 'Objection: Too Expensive', title: 'Acknowledge then reframe',
    line: "Totally fair. Let me show you what's actually inside that number — I think it'll change the conversation.",
    whyItWorks: "Acknowledging without flinching, then offering to unpack value, beats arguing against the price.",
    psychology: 'Objection Handling', tags: ['price', 'value', 'frame'] },
  { id: 'obj_price_002', category: 'Objection: Too Expensive', title: 'Compared to what?',
    line: "Help me understand — expensive compared to what? Another quote, hardware-store products, doing nothing?",
    whyItWorks: "Forces the customer to define their reference point, which often reveals a weak comparison.",
    psychology: 'Reframing', tags: ['price', 'discovery', 'frame'] },
  { id: 'obj_price_003', category: 'Objection: Too Expensive', title: 'Validate the concern, not the conclusion',
    line: "I hear you. Price is a real consideration. But before you decide it's too much, let me ask — what number were you expecting?",
    whyItWorks: "Validating the concern while asking for the expected number reveals the real budget gap.",
    psychology: 'Discovery', tags: ['price', 'discovery', 'empathy'] },
  { id: 'obj_price_004', category: 'Objection: Too Expensive', title: 'Cost of waiting',
    line: "I get it. The real question is whether the cost of waiting is bigger than the cost of starting.",
    whyItWorks: "Reframes price as a comparison between two costs, not a yes/no on one.",
    psychology: 'Loss Aversion', tags: ['price', 'loss', 'urgency'] },
  { id: 'obj_price_005', category: 'Objection: Too Expensive', title: 'Tiered offer',
    line: "If the full plan isn't a fit today, we have a lighter version that covers the highest-priority issues. Want me to walk through that?",
    whyItWorks: "Offering a smaller commitment beats walking away — and often the customer self-upgrades later.",
    psychology: 'Foot in the Door', tags: ['price', 'commitment', 'closing'] },
  { id: 'obj_price_006', category: 'Objection: Too Expensive', title: 'Per-day reframe',
    line: "When you actually break that down, it's about two dollars a day. Is that the part that doesn't work, or is it the upfront feel?",
    whyItWorks: "Combines daily-cost reframing with a discovery question to surface the real concern.",
    psychology: 'Price Reframing', tags: ['price', 'frame', 'discovery'] },
  { id: 'obj_price_007', category: 'Objection: Too Expensive', title: 'Quality reframe',
    line: "If price is the only thing, there's always somebody cheaper. The question is what they're cutting to get there.",
    whyItWorks: "Frames a cheap competitor as a quality risk — without naming names.",
    psychology: 'Quality Anchoring', tags: ['price', 'differentiation', 'authority'] },
  { id: 'obj_price_008', category: 'Objection: Too Expensive', title: 'Set the budget expectation',
    line: "Most homeowners in this situation invest somewhere in the few-hundred to low-thousands range over the course of a year. Where does that sit for you?",
    whyItWorks: "Anchors a range and asks for placement — usually surfaces the real budget faster than asking directly.",
    psychology: 'Anchoring', tags: ['price', 'anchor', 'discovery'] },
  { id: 'obj_price_009', category: 'Objection: Too Expensive', title: 'Total cost of doing nothing',
    line: "Let's say you skip it. What's the cost of dealing with one infestation? That number is usually higher than the plan.",
    whyItWorks: "Anchors against the cost of inaction, which often dwarfs the cost of the plan.",
    psychology: 'Loss Aversion', tags: ['price', 'loss', 'frame'] },
  { id: 'obj_price_010', category: 'Objection: Too Expensive', title: 'Strip the bundle',
    line: "If we strip out the parts you don't think you need, we can land somewhere different. Want me to show you what's negotiable?",
    whyItWorks: "Negotiating components forces the customer to value each piece, which usually surfaces willingness to pay.",
    psychology: 'Reframing', tags: ['price', 'value', 'consultative'] },
  { id: 'obj_price_011', category: 'Objection: Too Expensive', title: 'Frame as insurance',
    line: "Think of it less as buying pest control and more as an insurance policy for the property. Insurance always feels expensive — until it pays off.",
    whyItWorks: "Insurance framing makes the recurring fee feel like protection, not consumption.",
    psychology: 'Framing', tags: ['price', 'frame', 'value', 'risk'] },
  { id: 'obj_price_012', category: 'Objection: Too Expensive', title: 'Match a competitor honestly',
    line: "If you've got a written quote that's lower from a comparable company, share it — I'll tell you honestly whether we can match.",
    whyItWorks: "Confident transparency around competitor pricing builds trust and surfaces fake objections.",
    psychology: 'Transparency', tags: ['price', 'competitor', 'trust'] },
  { id: 'obj_price_013', category: 'Objection: Too Expensive', title: 'Concession with a commit',
    line: "If I can take fifty off the initial, would you start today?",
    whyItWorks: "Trades a defined concession for a defined commitment — the most powerful negotiation move there is.",
    psychology: 'Reciprocity', tags: ['price', 'reciprocity', 'closing', 'commitment'] },
  { id: 'obj_price_014', category: 'Objection: Too Expensive', title: 'Surface the real number',
    line: "If money wasn't a factor — would this be a yes today?",
    whyItWorks: "Separates the price objection from any other hidden objection. If the answer is no, price wasn't the real issue.",
    psychology: 'Objection Isolation', tags: ['price', 'discovery', 'closing'] },
  { id: 'obj_price_015', category: 'Objection: Too Expensive', title: 'Don\'t fight, redirect',
    line: "I won't try to convince you the price isn't real. Let me just make sure you've got the full picture of what you'd be choosing between.",
    whyItWorks: "Refusing to argue about price defuses the back-and-forth and reopens the value conversation.",
    psychology: 'Reframing', tags: ['price', 'frame', 'empathy'] },

  // ── OBJECTION: NEED TO THINK ────────────────────────────────────────────
  { id: 'obj_think_001', category: 'Objection: Need to Think', title: 'Honor it and find the real reason',
    line: "Totally fair. Just so I don't follow up on the wrong thing — what's the main thing you'd be thinking through?",
    whyItWorks: "Honors the request while surfacing the actual hesitation. 'I need to think' is almost never the real reason.",
    psychology: 'Objection Isolation', tags: ['decision', 'discovery', 'empathy'] },
  { id: 'obj_think_002', category: 'Objection: Need to Think', title: 'Make it easier to think',
    line: "Of course. What would make thinking about it easier — more details on cost, a written agreement, something else?",
    whyItWorks: "Shifts the conversation from 'I need to think' to 'here's what I need to think with.'",
    psychology: 'Consultative', tags: ['decision', 'discovery', 'consultative'] },
  { id: 'obj_think_003', category: 'Objection: Need to Think', title: 'Time-bound the thinking',
    line: "Take the time you need. If I check back at the end of the week, will you have a clearer picture by then?",
    whyItWorks: "Soft deadline creates accountability without pressure.",
    psychology: 'Commitment', tags: ['decision', 'follow-up', 'commitment'] },
  { id: 'obj_think_004', category: 'Objection: Need to Think', title: 'Season pressure',
    line: "Take your time. Just know that if we don't start before the season turns, the first visit pushes into next month — happy to hold the spot if it helps.",
    whyItWorks: "Real-world urgency (season) is more persuasive than artificial deadline pressure.",
    psychology: 'Urgency', tags: ['decision', 'urgency', 'seasonal', 'scarcity'] },
  { id: 'obj_think_005', category: 'Objection: Need to Think', title: 'Spouse or family',
    line: "Is there somebody else who'd be part of this decision? Happy to come back when you can talk together.",
    whyItWorks: "Invites the absent decision-maker into the loop instead of letting the deal die.",
    psychology: 'Discovery', tags: ['decision', 'discovery', 'follow-up'] },
  { id: 'obj_think_006', category: 'Objection: Need to Think', title: 'No-pressure approach',
    line: "Honestly, I'd rather you take a day than feel rushed. I'd just ask you to circle back — even to say no — so I'm not chasing.",
    whyItWorks: "Asking for a definitive answer either way pulls customers off the fence.",
    psychology: 'Reverse Psychology', tags: ['decision', 'empathy', 'commitment'] },
  { id: 'obj_think_007', category: 'Objection: Need to Think', title: 'The lock-the-price hook',
    line: "If you'd like, I can lock today's pricing for a week. That way you can think without worrying about the rate moving.",
    whyItWorks: "Removes the fear that hesitating costs money — which actually makes the customer more comfortable committing now.",
    psychology: 'Risk Reversal', tags: ['decision', 'price', 'urgency'] },
  { id: 'obj_think_008', category: 'Objection: Need to Think', title: 'Risk-free first visit',
    line: "If it's the commitment that's the question — we can do just the first visit. After that, you decide whether to continue.",
    whyItWorks: "Shrinks the decision to one low-stakes step.",
    psychology: 'Foot in the Door', tags: ['decision', 'risk', 'commitment'] },
  { id: 'obj_think_009', category: 'Objection: Need to Think', title: 'What\'s the missing information',
    line: "What's the piece of information you're missing right now? I might be able to answer it before I leave.",
    whyItWorks: "Often the customer doesn't actually know what they're waiting on. Surfacing it solves the objection.",
    psychology: 'Discovery', tags: ['decision', 'discovery', 'consultative'] },
  { id: 'obj_think_010', category: 'Objection: Need to Think', title: 'The next-step ask',
    line: "Totally — what's the next step on your end? Want me to send the agreement so you have something concrete to look at?",
    whyItWorks: "Defines the next concrete action, preventing the deal from stalling indefinitely.",
    psychology: 'Commitment', tags: ['decision', 'commitment', 'follow-up'] },
  { id: 'obj_think_011', category: 'Objection: Need to Think', title: 'Reverse the worry',
    line: "If you do think on it for a week — what's the worst that could happen on the property during that time?",
    whyItWorks: "Makes the customer imagine the cost of waiting, which often outweighs the cost of deciding.",
    psychology: 'Loss Aversion', tags: ['decision', 'loss', 'urgency'] },
  { id: 'obj_think_012', category: 'Objection: Need to Think', title: 'Direct trial close',
    line: "Setting price aside, is there anything else you'd want to think through before saying yes?",
    whyItWorks: "Isolates remaining objections so the conversation can resolve.",
    psychology: 'Objection Isolation', tags: ['decision', 'discovery', 'closing'] },

  // ── OBJECTION: ALREADY HAVE SERVICE ─────────────────────────────────────
  { id: 'obj_already_001', category: 'Objection: Already Have Service', title: 'Compliment then differentiate',
    line: "That's smart — most homeowners who care about the property already have somebody. Mind if I ask how it's been going?",
    whyItWorks: "Validates the customer's choice instead of attacking it. Opens space for honest feedback about the current provider.",
    psychology: 'Empathy', tags: ['competitor', 'discovery', 'empathy', 'switching'] },
  { id: 'obj_already_002', category: 'Objection: Already Have Service', title: 'Discovery on the current provider',
    line: "What do you like about them? And is there anything you'd change if you could?",
    whyItWorks: "Surfaces gaps without speaking badly of the competitor.",
    psychology: 'Discovery', tags: ['competitor', 'discovery', 'switching'] },
  { id: 'obj_already_003', category: 'Objection: Already Have Service', title: 'Offer to be a backup',
    line: "If you're happy with them, that's a great place to be. If something ever changes, keep my number — happy to be a second opinion.",
    whyItWorks: "Plants a flag for the future without burning the bridge.",
    psychology: 'Reciprocity', tags: ['competitor', 'relationship', 'follow-up'] },
  { id: 'obj_already_004', category: 'Objection: Already Have Service', title: 'Cost comparison',
    line: "Out of curiosity, what are you paying right now? I'd just want to make sure you're getting the right value.",
    whyItWorks: "Surfaces price comparison opportunity without pushing.",
    psychology: 'Discovery', tags: ['competitor', 'price', 'discovery'] },
  { id: 'obj_already_005', category: 'Objection: Already Have Service', title: 'Free second opinion',
    line: "Since I'm here — would you want a no-pressure second-opinion inspection? Compare what we'd recommend to what they're doing.",
    whyItWorks: "Low-stakes free inspection is hard to say no to and often surfaces differences.",
    psychology: 'Reciprocity', tags: ['competitor', 'switching', 'opening'] },
  { id: 'obj_already_006', category: 'Objection: Already Have Service', title: 'Surface the cracks',
    line: "When was your last visit? And were they able to tell you what they were watching for next time?",
    whyItWorks: "Specific questions about service quality often surface gaps the customer didn't realize existed.",
    psychology: 'Discovery', tags: ['competitor', 'discovery', 'switching'] },
  { id: 'obj_already_007', category: 'Objection: Already Have Service', title: 'Match-and-stay frame',
    line: "If we matched their pricing and gave you a stronger guarantee — would there be a reason not to switch?",
    whyItWorks: "Removes the financial barrier and surfaces whether the customer has any non-price reasons to stay.",
    psychology: 'Commitment', tags: ['competitor', 'price', 'switching', 'closing'] },
  { id: 'obj_already_008', category: 'Objection: Already Have Service', title: 'No-switching-fee promise',
    line: "If you ever wanted to make the switch, there's no fee, no contract pain — we handle the timing so you don't have a gap.",
    whyItWorks: "Lowers the cost of switching, which is often the real reason people stay with a worse vendor.",
    psychology: 'Risk Reversal', tags: ['competitor', 'switching', 'risk'] },
  { id: 'obj_already_009', category: 'Objection: Already Have Service', title: 'Direct ask',
    line: "Quick question — if a better option showed up tomorrow, would you consider it?",
    whyItWorks: "Surfaces willingness to switch without forcing it.",
    psychology: 'Discovery', tags: ['competitor', 'discovery', 'switching'] },
  { id: 'obj_already_010', category: 'Objection: Already Have Service', title: 'Frame on outcomes',
    line: "How would you grade the actual outcome — is the issue gone, mostly handled, or about the same as before?",
    whyItWorks: "Grading the outcome surfaces dissatisfaction the customer may not have voiced.",
    psychology: 'Discovery', tags: ['competitor', 'discovery', 'switching'] },
  { id: 'obj_already_011', category: 'Objection: Already Have Service', title: 'Compare what\'s included',
    line: "Just for context — does their plan include re-services between visits at no charge? A lot of companies don't.",
    whyItWorks: "Surface a specific differentiator the customer may not have realized was missing.",
    psychology: 'Differentiation', tags: ['competitor', 'differentiation', 'guarantee'] },
  { id: 'obj_already_012', category: 'Objection: Already Have Service', title: 'Slot the offer for renewal',
    line: "When's your renewal? Mind if I check back a couple weeks before so we can compare side by side?",
    whyItWorks: "Calendars the follow-up at a moment when the customer is naturally evaluating providers.",
    psychology: 'Follow-Up', tags: ['competitor', 'follow-up', 'relationship'] },

  // ── OBJECTION: NOT INTERESTED ───────────────────────────────────────────
  { id: 'obj_ni_001', category: 'Objection: Not Interested', title: 'Pattern-break, not persuasion',
    line: "Totally fair — most people aren't, until they are. Mind if I leave you a card in case something changes?",
    whyItWorks: "Refusing to fight the objection lowers defenses and leaves a future opening.",
    psychology: 'Reverse Psychology', tags: ['empathy', 'follow-up', 'relationship'] },
  { id: 'obj_ni_002', category: 'Objection: Not Interested', title: 'Acknowledge and disqualify',
    line: "Got it. Just so I'm not bothering you down the road — is it the timing, the cost, or pest control in general?",
    whyItWorks: "Surfaces the actual reason without arguing, and segments future follow-up accordingly.",
    psychology: 'Discovery', tags: ['empathy', 'discovery', 'follow-up'] },
  { id: 'obj_ni_003', category: 'Objection: Not Interested', title: 'Honor it, plant the seed',
    line: "Understood. If you ever do start seeing activity, the number's on the card — no charge to call and ask.",
    whyItWorks: "Leaves a low-friction future entry point that customers often use later.",
    psychology: 'Reciprocity', tags: ['empathy', 'follow-up', 'relationship'] },
  { id: 'obj_ni_004', category: 'Objection: Not Interested', title: 'Frame around prevention',
    line: "Totally fair. Most people aren't interested in pest control — they're interested in not having a pest problem. Different conversation.",
    whyItWorks: "Reframes the offer from a product the customer doesn't want to an outcome they do.",
    psychology: 'Reframing', tags: ['empathy', 'frame', 'value'] },
  { id: 'obj_ni_005', category: 'Objection: Not Interested', title: 'Ask if anybody else is',
    line: "Got it. Out of curiosity — is anybody on the street dealing with pest issues? I'd rather catch something on the block before it spreads.",
    whyItWorks: "Surfaces neighbor opportunities while disengaging gracefully.",
    psychology: 'Discovery', tags: ['empathy', 'discovery', 'social'] },
  { id: 'obj_ni_006', category: 'Objection: Not Interested', title: 'Trade the no for information',
    line: "Fair enough. Quick favor — if I left a one-pager that explains what's typical in this neighborhood at this time of year, would you take a look?",
    whyItWorks: "Gets a small yes after a no, which often re-opens the conversation later.",
    psychology: 'Foot in the Door', tags: ['empathy', 'commitment', 'follow-up'] },
  { id: 'obj_ni_007', category: 'Objection: Not Interested', title: 'Frame the no as smart',
    line: "Honestly, that's a reasonable instinct — most door-to-door pitches are forgettable. Mind if I take thirty seconds to explain what makes this different?",
    whyItWorks: "Acknowledges the customer's instinct and asks for a small, defined chunk of attention.",
    psychology: 'Empathy', tags: ['empathy', 'opening', 'commitment'] },
  { id: 'obj_ni_008', category: 'Objection: Not Interested', title: 'Disengage gracefully',
    line: "Totally hear you — have a good one. If you ever change your mind, you know where to find us.",
    whyItWorks: "Polite disengagement leaves the brand intact for future contact.",
    psychology: 'Empathy', tags: ['empathy', 'follow-up'] },

  // ── OBJECTION: TIMING ───────────────────────────────────────────────────
  { id: 'obj_time_001', category: 'Objection: Timing', title: 'Honor the timing, surface the cost',
    line: "Totally fair. The thing about pest issues is they don't really respect calendars — what's making this not the right time?",
    whyItWorks: "Honors the objection while surfacing the actual reason.",
    psychology: 'Discovery', tags: ['decision', 'discovery', 'urgency'] },
  { id: 'obj_time_002', category: 'Objection: Timing', title: 'Season-based urgency',
    line: "If it's about timing — the season changes in a few weeks. Starting now gets us ahead of it; starting later means we're catching up.",
    whyItWorks: "Real seasonal pressure is more persuasive than manufactured urgency.",
    psychology: 'Urgency', tags: ['urgency', 'seasonal', 'closing'] },
  { id: 'obj_time_003', category: 'Objection: Timing', title: 'Move the calendar, not the decision',
    line: "If today's not right, let's schedule the first visit two weeks out. You'd still have the rate locked but you don't deal with it now.",
    whyItWorks: "Decouples commitment from timing — both can move on different rails.",
    psychology: 'Commitment', tags: ['decision', 'commitment', 'appointment'] },
  { id: 'obj_time_004', category: 'Objection: Timing', title: 'What needs to be true',
    line: "Fair. What would need to be true for this to be the right time?",
    whyItWorks: "Asks the customer to define their own decision criteria — often a short, fixable list.",
    psychology: 'Discovery', tags: ['decision', 'discovery', 'consultative'] },
  { id: 'obj_time_005', category: 'Objection: Timing', title: 'The forever-not-right-time frame',
    line: "Honest question — when is the right time, usually? In my experience, 'later' tends to keep being later until something forces it.",
    whyItWorks: "Gently confronts the avoidance pattern most customers don't realize they're in.",
    psychology: 'Reframing', tags: ['decision', 'urgency', 'frame'] },
  { id: 'obj_time_006', category: 'Objection: Timing', title: 'Hold the spot',
    line: "If you want to hold the appointment slot for next week, you can cancel anytime up to twenty-four hours before. No risk.",
    whyItWorks: "Defers commitment without losing the booking.",
    psychology: 'Risk Reversal', tags: ['decision', 'commitment', 'appointment'] },
  { id: 'obj_time_007', category: 'Objection: Timing', title: 'Timing-as-trojan-horse',
    line: "Most of the time when somebody says timing, they mean budget. Is that part of it? No wrong answer.",
    whyItWorks: "Surfaces the real objection (often price) hiding behind the polite 'timing' answer.",
    psychology: 'Objection Isolation', tags: ['decision', 'discovery', 'price'] },
  { id: 'obj_time_008', category: 'Objection: Timing', title: 'Quick pre-season window',
    line: "We're heading into the busy season. If you wait, the earliest first-visit slot is usually three to four weeks out.",
    whyItWorks: "Real scheduling scarcity creates honest urgency.",
    psychology: 'Scarcity', tags: ['scarcity', 'urgency', 'appointment'] },
  { id: 'obj_time_009', category: 'Objection: Timing', title: 'Pin a future check-in',
    line: "No problem. Let's land on a date that does work — even if it's a month out — so neither of us has to wonder.",
    whyItWorks: "Pins the next concrete step, which keeps the deal alive without pressure.",
    psychology: 'Commitment', tags: ['decision', 'follow-up', 'commitment'] },
  { id: 'obj_time_010', category: 'Objection: Timing', title: 'Pre-empt the future regret',
    line: "If you wait, and the issue gets worse, we'll still be here — but a treatment in August costs more than prevention in May.",
    whyItWorks: "Reframes waiting as a more expensive path, not a neutral one.",
    psychology: 'Loss Aversion', tags: ['urgency', 'price', 'loss'] },

  // ── COMPETITOR SWITCHING ────────────────────────────────────────────────
  { id: 'comp_001', category: 'Competitor Switching', title: 'Acknowledge the incumbent',
    line: "Most of our new families came from another pest company. The reason is usually small things — communication, follow-through, the same tech showing up each time.",
    whyItWorks: "Normalizes switching without trashing the competitor.",
    psychology: 'Social Proof', tags: ['competitor', 'switching', 'differentiation'] },
  { id: 'comp_002', category: 'Competitor Switching', title: 'No-overlap promise',
    line: "We coordinate the switch so you're never without coverage — you stop them after our first visit, not before.",
    whyItWorks: "Removes a logistical friction that often keeps customers with a worse provider.",
    psychology: 'Risk Reversal', tags: ['competitor', 'switching', 'risk'] },
  { id: 'comp_003', category: 'Competitor Switching', title: 'Compare what\'s in writing',
    line: "Bring me a copy of their agreement. We'll go line-by-line — fair to both sides.",
    whyItWorks: "Direct, confident comparison signals you have nothing to hide.",
    psychology: 'Authority', tags: ['competitor', 'differentiation', 'trust'] },
  { id: 'comp_004', category: 'Competitor Switching', title: 'Match-then-exceed',
    line: "I won't ask you to switch just for the same thing at the same price. Let's figure out where we'd actually do better.",
    whyItWorks: "Refuses a price-for-price match, signaling you compete on value not just cost.",
    psychology: 'Differentiation', tags: ['competitor', 'value', 'differentiation'] },
  { id: 'comp_005', category: 'Competitor Switching', title: 'Outcome comparison',
    line: "Has the issue actually been gone the last six months, or has it just been managed?",
    whyItWorks: "Surfaces an outcome gap the customer may not have voiced.",
    psychology: 'Discovery', tags: ['competitor', 'discovery', 'switching'] },
  { id: 'comp_006', category: 'Competitor Switching', title: 'Frame the loyalty paradox',
    line: "Loyalty to a vendor is a great instinct — but only if they're still earning it. Are they?",
    whyItWorks: "Reframes loyalty from an obligation to a contingent choice.",
    psychology: 'Reframing', tags: ['competitor', 'frame', 'switching'] },
  { id: 'comp_007', category: 'Competitor Switching', title: 'Local versus national',
    line: "If your current provider is a national chain, you're talking to a different person every time. We're local — you'll know your tech.",
    whyItWorks: "Differentiates on something hard for big competitors to replicate.",
    psychology: 'Differentiation', tags: ['competitor', 'differentiation', 'relationship'] },
  { id: 'comp_008', category: 'Competitor Switching', title: 'Show, don\'t tell',
    line: "I won't spend ten minutes telling you we're better. Let me do the first inspection and you can see for yourself.",
    whyItWorks: "Removes the 'salesman' frame and lets the work do the convincing.",
    psychology: 'Show Don\'t Tell', tags: ['competitor', 'consultative', 'opening'] },
  { id: 'comp_009', category: 'Competitor Switching', title: 'Renewal-window timing',
    line: "When does your current plan end? Easier to switch at renewal than mid-contract.",
    whyItWorks: "Removes friction by aligning the switch with a natural decision point.",
    psychology: 'Foot in the Door', tags: ['competitor', 'follow-up', 'switching'] },
  { id: 'comp_010', category: 'Competitor Switching', title: 'No badmouthing rule',
    line: "I won't trash anybody — there are good companies in this space. But here's where we'd handle your property differently.",
    whyItWorks: "Professional refusal to badmouth competitors signals confidence and integrity.",
    psychology: 'Authority', tags: ['competitor', 'authority', 'trust', 'differentiation'] },

  // ── RELATIONSHIP SELLING ────────────────────────────────────────────────
  { id: 'rel_001', category: 'Relationship Selling', title: 'Long horizon framing',
    line: "I'd rather have you as a customer for ten years than make a sale today. That changes how I'd ever pitch you.",
    whyItWorks: "Long-horizon framing positions the rep as a partner, not a closer.",
    psychology: 'Relationship Selling', tags: ['relationship', 'trust', 'empathy'] },
  { id: 'rel_002', category: 'Relationship Selling', title: 'Off-script disclosure',
    line: "Quick honest disclosure — I'm not on commission to push you into anything. The plan only works if it actually fits you.",
    whyItWorks: "Stating the absence of pressure is often more believable than acting un-pressured.",
    psychology: 'Transparency', tags: ['relationship', 'transparency', 'trust'] },
  { id: 'rel_003', category: 'Relationship Selling', title: 'Refer to the customer by name',
    line: "Based on what you said earlier about the basement — let me focus there first.",
    whyItWorks: "Using the customer's name and recalling their words signals you've been listening, not pitching.",
    psychology: 'Active Listening', tags: ['relationship', 'empathy', 'consultative'] },
  { id: 'rel_004', category: 'Relationship Selling', title: 'Personal anchor',
    line: "I treat properties in this neighborhood every week. I'm not going anywhere — easier to do this right than to chase the sale.",
    whyItWorks: "Geographic presence is a real, persistent trust signal.",
    psychology: 'Relationship Selling', tags: ['relationship', 'trust', 'authority'] },
  { id: 'rel_005', category: 'Relationship Selling', title: 'Permission-based selling',
    line: "Is it okay if I ask you a few questions before recommending anything?",
    whyItWorks: "Asking permission flips the dynamic from sales-to-customer to consultant-to-client.",
    psychology: 'Permission Marketing', tags: ['relationship', 'consultative', 'discovery'] },
  { id: 'rel_006', category: 'Relationship Selling', title: 'Treat them like a peer',
    line: "I'm going to walk you through this the same way I'd want somebody to walk my mother through it. Straight, no fluff.",
    whyItWorks: "Stating the standard makes the customer feel respected, not handled.",
    psychology: 'Empathy', tags: ['relationship', 'empathy', 'trust'] },
  { id: 'rel_007', category: 'Relationship Selling', title: 'Remember details next time',
    line: "Last time we talked, you mentioned the dog walks the perimeter — I made a note. We'll keep that area safe-by-design.",
    whyItWorks: "Remembering personal details across visits is the heart of relationship selling.",
    psychology: 'Active Listening', tags: ['relationship', 'trust', 'consultative'] },
  { id: 'rel_008', category: 'Relationship Selling', title: 'Lead with a small honest opinion',
    line: "Honestly — based on what I'm seeing, you don't need our top-tier plan. Quarterly is plenty.",
    whyItWorks: "Recommending less than the max is the fastest way to build long-term trust.",
    psychology: 'Reverse Psychology', tags: ['relationship', 'transparency', 'trust'] },
  { id: 'rel_009', category: 'Relationship Selling', title: 'Open the door for direct contact',
    line: "Here's my direct number — you don't need to go through the office. If something pops up, you text me.",
    whyItWorks: "Direct accessibility is a personal differentiator and trust-builder.",
    psychology: 'Relationship Selling', tags: ['relationship', 'trust', 'follow-up'] },
  { id: 'rel_010', category: 'Relationship Selling', title: 'Frame as partnership',
    line: "Think of me less like a vendor and more like the person responsible for keeping this property pest-free. That's how I'd treat it.",
    whyItWorks: "Partnership framing changes the customer's expectations and the rep's accountability in their head.",
    psychology: 'Framing', tags: ['relationship', 'frame', 'trust'] },

  // ── URGENCY ─────────────────────────────────────────────────────────────
  { id: 'urg_001', category: 'Urgency', title: 'Real seasonal urgency',
    line: "Tick season starts in about three weeks. Treatments work best when they're in place before that, not after the first sighting.",
    whyItWorks: "Real seasonal urgency is honest and persuasive.",
    psychology: 'Urgency', tags: ['urgency', 'seasonal', 'closing'] },
  { id: 'urg_002', category: 'Urgency', title: 'Biological lifecycle urgency',
    line: "Ant colonies double in size during the spring buildup. The earlier we interrupt, the less we have to treat later.",
    whyItWorks: "Biological urgency is concrete and undeniable.",
    psychology: 'Urgency', tags: ['urgency', 'authority', 'seasonal'] },
  { id: 'urg_003', category: 'Urgency', title: 'Booking availability urgency',
    line: "I have a slot open this Thursday. If you want it, we should hold it now — Thursdays go fast this month.",
    whyItWorks: "Real scheduling scarcity creates pressure without exaggeration.",
    psychology: 'Scarcity', tags: ['urgency', 'scarcity', 'appointment'] },
  { id: 'urg_004', category: 'Urgency', title: 'Pricing lock urgency',
    line: "Pricing is locked at today's rate if we start this week. Next week, it depends on what the new season schedule looks like.",
    whyItWorks: "Time-bound pricing creates honest action pressure.",
    psychology: 'Scarcity', tags: ['urgency', 'price', 'scarcity'] },
  { id: 'urg_005', category: 'Urgency', title: 'Property-specific deterioration',
    line: "Based on what I saw in the crawl space, this gets harder to fix the longer it sits.",
    whyItWorks: "Specific, evidence-based urgency is much more persuasive than generic 'act now.'",
    psychology: 'Loss Aversion', tags: ['urgency', 'authority', 'loss'] },
  { id: 'urg_006', category: 'Urgency', title: 'The compounding-cost line',
    line: "Every month you wait, the treatment plan gets slightly bigger. It compounds.",
    whyItWorks: "Compounding cost is intuitive and pressures action without manufactured deadlines.",
    psychology: 'Urgency', tags: ['urgency', 'price', 'loss'] },
  { id: 'urg_007', category: 'Urgency', title: 'Pre-emptive call urgency',
    line: "Right now we're working on prevention. Wait too long and the same visit becomes treatment — which is more involved.",
    whyItWorks: "Frames acting now as the easier, cheaper path.",
    psychology: 'Urgency', tags: ['urgency', 'prevention', 'value'] },
  { id: 'urg_008', category: 'Urgency', title: 'Real urgency, no theater',
    line: "I'm not going to invent urgency. But the season is changing in three weeks — that's the real timer here.",
    whyItWorks: "Acknowledging that you won't manipulate makes the actual urgency more believable.",
    psychology: 'Transparency', tags: ['urgency', 'trust', 'seasonal'] },
  { id: 'urg_009', category: 'Urgency', title: 'The window-closing frame',
    line: "We have about a four-week window where prevention is most effective. After that, we're catching up instead of getting ahead.",
    whyItWorks: "Defining a window of effectiveness creates honest scarcity.",
    psychology: 'Scarcity', tags: ['urgency', 'scarcity', 'seasonal'] },
  { id: 'urg_010', category: 'Urgency', title: 'Schedule cascade urgency',
    line: "If we start this week, your visits land on the same weekday all year. Wait, and we're shuffling your schedule.",
    whyItWorks: "Operational urgency creates a small but real cost to delay.",
    psychology: 'Urgency', tags: ['urgency', 'commitment', 'appointment'] },

  // ── SCARCITY ────────────────────────────────────────────────────────────
  { id: 'sca_001', category: 'Scarcity', title: 'Honest route availability',
    line: "We can only take a handful of new properties on this route. Once it's full, the next opening is two months out.",
    whyItWorks: "Real operational scarcity (route density) is honest and persuasive.",
    psychology: 'Scarcity', tags: ['scarcity', 'urgency', 'closing'] },
  { id: 'sca_002', category: 'Scarcity', title: 'New-customer pricing window',
    line: "First-year pricing is best if you start during the off-season. We don't run it forever.",
    whyItWorks: "Defined-window pricing is real scarcity, not manufactured.",
    psychology: 'Scarcity', tags: ['scarcity', 'price', 'closing'] },
  { id: 'sca_003', category: 'Scarcity', title: 'Tech-availability scarcity',
    line: "Our senior techs book out fast in the spring. If you want a specific person assigned, the sooner the better.",
    whyItWorks: "Personal-resource scarcity feels personal and matters more than abstract availability.",
    psychology: 'Scarcity', tags: ['scarcity', 'authority', 'appointment'] },
  { id: 'sca_004', category: 'Scarcity', title: 'Bundle discount window',
    line: "If we bundle the initial inspection with the first visit, we can include it at no charge — that promotion runs through this season only.",
    whyItWorks: "Time-bound bundle pricing creates a real reason to act now.",
    psychology: 'Scarcity', tags: ['scarcity', 'price', 'closing'] },
  { id: 'sca_005', category: 'Scarcity', title: 'No-spot-on-the-truck scarcity',
    line: "We run a fixed number of stops per truck per day. Once a route is full, new properties go on a waitlist.",
    whyItWorks: "Operational reality, stated honestly, is its own scarcity.",
    psychology: 'Scarcity', tags: ['scarcity', 'urgency', 'authority'] },
  { id: 'sca_006', category: 'Scarcity', title: 'Limited-time guarantee',
    line: "We can include the extended guarantee for plans started this season. After that, it's not on the menu.",
    whyItWorks: "Limiting the offer's scope by season makes the offer feel finite.",
    psychology: 'Scarcity', tags: ['scarcity', 'guarantee', 'closing'] },
  { id: 'sca_007', category: 'Scarcity', title: 'Avoid manufactured scarcity',
    line: "I'm not going to invent a fake deadline. But the actual schedule does fill up — and that's worth knowing.",
    whyItWorks: "Naming the temptation to fake scarcity makes the real scarcity more credible.",
    psychology: 'Transparency', tags: ['scarcity', 'trust', 'authority'] },
  { id: 'sca_008', category: 'Scarcity', title: 'Specific seat count',
    line: "We've got two openings left on the spring schedule for this neighborhood. Want to take one?",
    whyItWorks: "Specific numbers feel more real than vague 'limited availability.'",
    psychology: 'Scarcity', tags: ['scarcity', 'closing', 'urgency'] },

  // ── RECIPROCITY ─────────────────────────────────────────────────────────
  { id: 'rec_001', category: 'Reciprocity', title: 'Free inspection as gift',
    line: "The initial inspection is on us — even if you don't end up signing up.",
    whyItWorks: "Genuine free value triggers reciprocity, which raises close rate.",
    psychology: 'Reciprocity', tags: ['reciprocity', 'opening', 'closing'] },
  { id: 'rec_002', category: 'Reciprocity', title: 'Free non-pest help',
    line: "While I'm here — that gap near the foundation isn't a pest issue, but you should know about it. Easy thirty-dollar fix at the hardware store.",
    whyItWorks: "Giving away unrelated value triggers reciprocity that doesn't feel transactional.",
    psychology: 'Reciprocity', tags: ['reciprocity', 'authority', 'trust'] },
  { id: 'rec_003', category: 'Reciprocity', title: 'Concession with a request',
    line: "I'll take fifty off the initial — and in return, I'd love to lock the start date today. Fair trade?",
    whyItWorks: "Reciprocity works both ways. A defined trade is more honest than a one-sided concession.",
    psychology: 'Reciprocity', tags: ['reciprocity', 'closing', 'commitment'] },
  { id: 'rec_004', category: 'Reciprocity', title: 'Knowledge gift',
    line: "Even if you don't sign up, here are the three things I'd watch for on a property like this over the next six months.",
    whyItWorks: "Free expertise creates obligation without pressure.",
    psychology: 'Reciprocity', tags: ['reciprocity', 'authority', 'consultative'] },
  { id: 'rec_005', category: 'Reciprocity', title: 'Small unexpected favor',
    line: "While I'm here, let me put a couple monitors in the basement. They'll tell us in a week if there's actually an issue.",
    whyItWorks: "Unrequested small favor creates reciprocity without feeling like a sales tactic.",
    psychology: 'Reciprocity', tags: ['reciprocity', 'consultative', 'opening'] },
  { id: 'rec_006', category: 'Reciprocity', title: 'Refer them to a competitor honestly',
    line: "We're not the right fit for that — but here's a company that does it well. They'll take care of you.",
    whyItWorks: "Referring out builds enormous reciprocity and reputation.",
    psychology: 'Reciprocity', tags: ['reciprocity', 'trust', 'transparency'] },

  // ── COMMITMENT & CONSISTENCY ────────────────────────────────────────────
  { id: 'com_001', category: 'Commitment & Consistency', title: 'Small yes ladder',
    line: "Quick yes/no — does the property generally feel like it has more pest activity than you'd like?",
    whyItWorks: "Small initial yes-commitments make larger commitments more likely.",
    psychology: 'Commitment & Consistency', tags: ['commitment', 'discovery', 'closing'] },
  { id: 'com_002', category: 'Commitment & Consistency', title: 'Self-described problem',
    line: "Tell me in your own words what the issue is. That way we're solving the actual problem, not what I assume.",
    whyItWorks: "Customers honor commitments they made themselves — including problem descriptions.",
    psychology: 'Commitment & Consistency', tags: ['commitment', 'discovery', 'consultative'] },
  { id: 'com_003', category: 'Commitment & Consistency', title: 'Recap their priorities',
    line: "Earlier you said keeping the kids' play area safe was the top thing. Let me make sure the plan reflects that.",
    whyItWorks: "Repeating the customer's stated priorities makes the offer feel custom — and prior commitments harder to walk back.",
    psychology: 'Commitment & Consistency', tags: ['commitment', 'empathy', 'closing'] },
  { id: 'com_004', category: 'Commitment & Consistency', title: 'Public commitment',
    line: "If you let me put it in writing right now, that locks the rate and the schedule. Nothing changes after that.",
    whyItWorks: "Written commitment is much stickier than verbal — for both parties.",
    psychology: 'Commitment & Consistency', tags: ['commitment', 'closing', 'trust'] },
  { id: 'com_005', category: 'Commitment & Consistency', title: 'Start with the easy choice',
    line: "Before we land on the plan — quick one. Quarterly visits or monthly? Most homes are quarterly.",
    whyItWorks: "Asking for the easier decision first builds momentum toward the harder one.",
    psychology: 'Commitment & Consistency', tags: ['commitment', 'closing'] },
  { id: 'com_006', category: 'Commitment & Consistency', title: 'Recall their own words',
    line: "You said earlier the carpenter ants were the deal-breaker. Here's how the plan handles exactly that.",
    whyItWorks: "Reflecting the customer's own words back is one of the strongest persuasion patterns.",
    psychology: 'Commitment & Consistency', tags: ['commitment', 'empathy', 'closing'] },
  { id: 'com_007', category: 'Commitment & Consistency', title: 'Step-by-step yes path',
    line: "Step one is just the inspection. Want to do that this week?",
    whyItWorks: "Breaking the commitment into small steps converts hesitation into action.",
    psychology: 'Foot in the Door', tags: ['commitment', 'closing', 'appointment'] },
  { id: 'com_008', category: 'Commitment & Consistency', title: 'Lock the date first',
    line: "Let's get a date on the calendar first — we can sort the plan details together.",
    whyItWorks: "A scheduled date is a soft commitment that often hardens into a closed deal.",
    psychology: 'Commitment & Consistency', tags: ['commitment', 'closing', 'appointment'] },

  // ── ANCHORING ───────────────────────────────────────────────────────────
  { id: 'anc_001', category: 'Anchoring', title: 'High-end first',
    line: "Most homeowners with this kind of property end up on our full-coverage plan — let me describe that first, then we can dial it back if it's more than you need.",
    whyItWorks: "Anchoring high makes lower-tier options feel like savings.",
    psychology: 'Anchoring', tags: ['anchor', 'price', 'closing'] },
  { id: 'anc_002', category: 'Anchoring', title: 'Anchor with the cost of a problem',
    line: "Just so we have a reference — a single rodent issue can cost two thousand to remediate. Compare that to anything we'd quote.",
    whyItWorks: "A high anchor makes the plan's price feel reasonable by comparison.",
    psychology: 'Anchoring', tags: ['anchor', 'price', 'loss'] },
  { id: 'anc_003', category: 'Anchoring', title: 'Anchor to bigger annual costs',
    line: "For context — most homeowners spend more on landscaping in a year than this plan costs.",
    whyItWorks: "Anchoring to a familiar larger expense makes the new one feel small.",
    psychology: 'Anchoring', tags: ['anchor', 'price', 'frame'] },
  { id: 'anc_004', category: 'Anchoring', title: 'Anchor on competitor pricing',
    line: "The national chains in this area typically charge within a known range. We're inside that range and we include more.",
    whyItWorks: "Anchoring against competitor pricing reframes the offer as a value option.",
    psychology: 'Anchoring', tags: ['anchor', 'competitor', 'value'] },
  { id: 'anc_005', category: 'Anchoring', title: 'Anchor with the worst-case number',
    line: "Worst case if you don't treat — five thousand dollars to remediate a bedbug or rodent issue. That's the actual anchor.",
    whyItWorks: "Specific large numbers create reference points that shrink everything below.",
    psychology: 'Anchoring', tags: ['anchor', 'loss', 'risk'] },
  { id: 'anc_006', category: 'Anchoring', title: 'Anchor to insurance',
    line: "Think about it like home insurance — same monthly idea, smaller bill. Insurance feels normal because it pays off when it's needed.",
    whyItWorks: "Anchoring to an accepted recurring expense normalizes the recurring fee.",
    psychology: 'Anchoring', tags: ['anchor', 'price', 'frame'] },
  { id: 'anc_007', category: 'Anchoring', title: 'Anchor by service scope',
    line: "The full plan covers four visits, free re-services, and the inspection. If you stripped any of those out, you'd be in the ten-percent-cheaper range — but you'd lose what makes it work.",
    whyItWorks: "Anchoring by scope reframes the price as a function of what's included.",
    psychology: 'Anchoring', tags: ['anchor', 'value', 'frame'] },
  { id: 'anc_008', category: 'Anchoring', title: 'Anchor to a wasp-call estimate',
    line: "One emergency wasp removal is usually three hundred dollars by itself. The plan includes that kind of work all year.",
    whyItWorks: "Anchor to a specific high-value included service so the price feels efficient.",
    psychology: 'Anchoring', tags: ['anchor', 'value', 'price'] },

  // ── FRAMING ─────────────────────────────────────────────────────────────
  { id: 'frm_001', category: 'Framing', title: 'Prevention frame',
    line: "Most of what we do isn't pest control — it's pest prevention. Different thing entirely.",
    whyItWorks: "Reframing the category from 'reactive' to 'preventive' shifts how the customer evaluates the offer.",
    psychology: 'Framing', tags: ['frame', 'prevention', 'value'], curated: true  },
  { id: 'frm_002', category: 'Framing', title: 'Risk-as-default frame',
    line: "The default state of an untreated property is 'pest vulnerable.' Treatment just shifts the default.",
    whyItWorks: "Reframing inaction as a choice rather than a neutral state surfaces hidden cost.",
    psychology: 'Framing', tags: ['frame', 'risk'] },
  { id: 'frm_003', category: 'Framing', title: 'Health-frame',
    line: "What we do is health and safety as much as it is pest control.",
    whyItWorks: "Reframing the service from pest control to health and safety shifts the customer's mental category.",
    psychology: 'Framing', tags: ['frame', 'value', 'residential'] },
  { id: 'frm_004', category: 'Framing', title: 'Property-value frame',
    line: "Pest prevention is a property-value play more than a comfort play. It protects what the home is worth.",
    whyItWorks: "Reframing the service against the property's value justifies the recurring cost.",
    psychology: 'Framing', tags: ['frame', 'value', 'residential'] },
  { id: 'frm_005', category: 'Framing', title: 'Insurance frame',
    line: "Same way you wouldn't drop your homeowners insurance because you 'might not need it' — pest prevention is the same idea.",
    whyItWorks: "Anchoring against insurance normalizes the recurring spend.",
    psychology: 'Framing', tags: ['frame', 'value', 'risk'] },
  { id: 'frm_006', category: 'Framing', title: 'Choice-architecture frame',
    line: "The real choice isn't whether to do something — it's whether to be ahead of it or behind it.",
    whyItWorks: "Reframes the decision to remove the 'do nothing' option from the customer's mental menu.",
    psychology: 'Framing', tags: ['frame', 'urgency'] },
  { id: 'frm_007', category: 'Framing', title: 'Maintenance frame',
    line: "Most homeowners think of this like changing a furnace filter — routine maintenance, not a special event.",
    whyItWorks: "Reframing as routine maintenance makes the recurring nature feel normal.",
    psychology: 'Framing', tags: ['frame', 'value', 'residential'] },
  { id: 'frm_008', category: 'Framing', title: 'Frame the cost as protection',
    line: "Every monthly invoice is essentially a small insurance premium against a much larger possible bill.",
    whyItWorks: "Frames the spend as protection against loss, which weighs heavier than purchase.",
    psychology: 'Framing', tags: ['frame', 'price', 'risk'] },
  { id: 'frm_009', category: 'Framing', title: 'Frame as a system, not a service',
    line: "What we set up is a system — visits, monitoring, communication. Not just a treatment.",
    whyItWorks: "System framing justifies the recurring price by emphasizing structure and accountability.",
    psychology: 'Framing', tags: ['frame', 'value', 'differentiation'] },
  { id: 'frm_010', category: 'Framing', title: 'Frame from the future',
    line: "Picture the property a year from now. Two paths — one where this is handled, one where it's still on your mind. Which one do you want?",
    whyItWorks: "Future-tense framing makes the outcome real and pressures a choice.",
    psychology: 'Framing', tags: ['frame', 'closing', 'value'] },

  // ── CONSULTATIVE SELLING ────────────────────────────────────────────────
  { id: 'cons_001', category: 'Consultative Selling', title: 'Diagnose before pitch',
    line: "Before I tell you what we'd do, I want to make sure I understand what's actually happening. Mind walking me through it?",
    whyItWorks: "Diagnosing before prescribing is the heart of consultative selling.",
    psychology: 'Consultative Selling', tags: ['consultative', 'discovery', 'opening'] },
  { id: 'cons_002', category: 'Consultative Selling', title: 'Ask, don\'t tell',
    line: "What's been your experience with pest companies in the past?",
    whyItWorks: "Asking forces the customer to do the talking, which builds rapport and surfaces real needs.",
    psychology: 'Consultative Selling', tags: ['consultative', 'discovery', 'opening'] },
  { id: 'cons_003', category: 'Consultative Selling', title: 'Recommend less than the max',
    line: "Based on what I'm seeing, you don't need the full plan. The quarterly is overkill — let me walk you through the lighter version.",
    whyItWorks: "Recommending less than the most expensive option dramatically increases trust.",
    psychology: 'Consultative Selling', tags: ['consultative', 'trust', 'transparency'] },
  { id: 'cons_004', category: 'Consultative Selling', title: 'Disagree when needed',
    line: "Actually — I don't think that's the right path for what you're describing. Here's what I'd do instead.",
    whyItWorks: "Polite disagreement signals expertise. Customers trust experts who push back, not those who agree with everything.",
    psychology: 'Authority', tags: ['consultative', 'authority', 'differentiation'] },
  { id: 'cons_005', category: 'Consultative Selling', title: 'Tell them what won\'t work',
    line: "If you've been trying hardware-store sprays, the reason it isn't working is — let me show you.",
    whyItWorks: "Explaining why their current approach fails establishes expertise and creates a need without pressure.",
    psychology: 'Consultative Selling', tags: ['consultative', 'authority', 'differentiation'] },
  { id: 'cons_006', category: 'Consultative Selling', title: 'Reflect understanding before pitching',
    line: "So just to play back what I heard — the issue is in the basement, started about a month ago, and you've already tried a few hardware-store products. Is that right?",
    whyItWorks: "Reflecting demonstrates listening and ensures the recommendation lands on the right problem.",
    psychology: 'Active Listening', tags: ['consultative', 'empathy', 'discovery'] },
  { id: 'cons_007', category: 'Consultative Selling', title: 'Tiered options',
    line: "There are basically three ways to handle this — let me walk you through all of them so you can see the trade-offs.",
    whyItWorks: "Presenting tiered options positions the rep as a consultant rather than a pitcher.",
    psychology: 'Decision Framing', tags: ['consultative', 'closing', 'value'] },
  { id: 'cons_008', category: 'Consultative Selling', title: 'Co-create the plan',
    line: "Let's build the plan together. What matters most — keeping the kids safe, protecting the foundation, peace of mind?",
    whyItWorks: "Co-creation makes the customer own the plan, which dramatically increases close rate and retention.",
    psychology: 'Consultative Selling', tags: ['consultative', 'discovery', 'commitment'] },
  { id: 'cons_009', category: 'Consultative Selling', title: 'Pre-empt the objection',
    line: "Before you ask — yes, this works around pets. Yes, the agreement is no-lock-in. Yes, the same tech most visits. Most people want those three answers up front.",
    whyItWorks: "Anticipating common objections before they're raised signals expertise and saves time.",
    psychology: 'Consultative Selling', tags: ['consultative', 'trust', 'opening'] },
  { id: 'cons_010', category: 'Consultative Selling', title: 'Educate even if no sale',
    line: "Whether or not you go with us, here are the three things you should know about pest control in this region.",
    whyItWorks: "Free education builds reciprocity and trust, which pays off long after the visit.",
    psychology: 'Reciprocity', tags: ['consultative', 'reciprocity', 'authority'] },

  // ── APPOINTMENT SETTING ─────────────────────────────────────────────────
  { id: 'appt_001', category: 'Appointment Setting', title: 'Two-option close',
    line: "What works better — Tuesday morning or Thursday afternoon?",
    whyItWorks: "Two-option closes are the highest-converting appointment-setting pattern.",
    psychology: 'Alternative Choice Close', tags: ['appointment', 'closing', 'commitment'] },
  { id: 'appt_002', category: 'Appointment Setting', title: 'Pre-frame the visit',
    line: "Just so you know what to expect — the visit is about thirty minutes, and you don't need to be home for the work itself.",
    whyItWorks: "Pre-framing removes friction (time, presence) that often blocks scheduling.",
    psychology: 'Pre-empting Objections', tags: ['appointment', 'trust', 'consultative'] },
  { id: 'appt_003', category: 'Appointment Setting', title: 'The hold-the-slot ask',
    line: "I can hold this Thursday for you for the next hour. After that I'll let it go to somebody else.",
    whyItWorks: "Soft scarcity with a specific time pressure converts hesitation to commitment.",
    psychology: 'Scarcity', tags: ['appointment', 'scarcity', 'urgency'] },
  { id: 'appt_004', category: 'Appointment Setting', title: 'Calendar over conversation',
    line: "Instead of going back and forth — what does your calendar look like next week?",
    whyItWorks: "Moving directly to logistics assumes the yes without explicit ask.",
    psychology: 'Assumptive Close', tags: ['appointment', 'closing', 'commitment'] },
  { id: 'appt_005', category: 'Appointment Setting', title: 'Confirmation cadence',
    line: "You'll get a text two days before with the tech's name and ETA. If anything changes, just reply.",
    whyItWorks: "Naming the confirmation process makes the appointment feel professional and certain.",
    psychology: 'Trust', tags: ['appointment', 'trust', 'consultative'] },
  { id: 'appt_006', category: 'Appointment Setting', title: 'Soft re-confirm',
    line: "Quick confirm — Thursday at ten? I'll lock it now so you don't have to remember.",
    whyItWorks: "Reducing the cognitive cost of the commitment removes friction.",
    psychology: 'Foot in the Door', tags: ['appointment', 'commitment'] },
  { id: 'appt_007', category: 'Appointment Setting', title: 'Anchor to the season',
    line: "If we get you on the calendar this week, you're in the schedule before the spring rush.",
    whyItWorks: "Real seasonal scarcity creates a meaningful reason to book now.",
    psychology: 'Urgency', tags: ['appointment', 'urgency', 'seasonal'] },
  { id: 'appt_008', category: 'Appointment Setting', title: 'Friction removal',
    line: "You don't need to do anything before the visit — we bring everything. Just point us to the back door.",
    whyItWorks: "Removing pre-visit prep work eliminates a hidden friction.",
    psychology: 'Friction Removal', tags: ['appointment', 'consultative', 'trust'] },
  { id: 'appt_009', category: 'Appointment Setting', title: 'Combined inspection-and-treatment',
    line: "If we go ahead, we can do the inspection and the first treatment in the same visit. Saves you a second appointment.",
    whyItWorks: "Combining visits reduces the total commitment ask and creates obvious efficiency.",
    psychology: 'Convenience Framing', tags: ['appointment', 'value', 'closing'] },
  { id: 'appt_010', category: 'Appointment Setting', title: 'Reciprocity slot',
    line: "I have a slot opening because somebody just rescheduled. Want it?",
    whyItWorks: "Opportunity framing implies value and creates instant decision pressure.",
    psychology: 'Scarcity', tags: ['appointment', 'scarcity', 'closing'] },

  // ── FOLLOW-UP ───────────────────────────────────────────────────────────
  { id: 'fu_001', category: 'Follow-Up', title: 'The 2-day check',
    line: "I'll check back in two days — that gives you time without the conversation going cold.",
    whyItWorks: "Pre-committing to a follow-up cadence sets expectations and prevents ghosting.",
    psychology: 'Commitment', tags: ['follow-up', 'commitment', 'relationship'] },
  { id: 'fu_002', category: 'Follow-Up', title: 'Reason to call back',
    line: "When I call back, I want to bring you something — what would be useful to know that I don't have today?",
    whyItWorks: "Tying the follow-up to a deliverable creates a reason for the customer to expect the call.",
    psychology: 'Reciprocity', tags: ['follow-up', 'reciprocity', 'consultative'] },
  { id: 'fu_003', category: 'Follow-Up', title: 'Specific time, specific question',
    line: "I'll call Thursday at three. The only question I'll ask is whether you're still thinking about it or you've decided.",
    whyItWorks: "Specificity makes the call feel respectful and easy to answer.",
    psychology: 'Transparency', tags: ['follow-up', 'trust', 'closing'] },
  { id: 'fu_004', category: 'Follow-Up', title: 'Permission-to-follow-up',
    line: "Is it okay if I check back in a week? I'd rather ask than just show up in your inbox.",
    whyItWorks: "Asking permission for follow-up dramatically increases response rate.",
    psychology: 'Permission Marketing', tags: ['follow-up', 'empathy', 'trust'] },
  { id: 'fu_005', category: 'Follow-Up', title: 'Email summary',
    line: "I'll send you a one-page summary tonight so you have everything in writing — no need to remember.",
    whyItWorks: "Reducing memory burden makes the customer more comfortable engaging again.",
    psychology: 'Friction Removal', tags: ['follow-up', 'consultative', 'trust'] },
  { id: 'fu_006', category: 'Follow-Up', title: 'Seasonal check-in',
    line: "I'll touch base before the spring season — that's usually when most people decide to act.",
    whyItWorks: "Timing follow-ups to natural decision moments increases relevance.",
    psychology: 'Timing', tags: ['follow-up', 'urgency', 'seasonal'] },
  { id: 'fu_007', category: 'Follow-Up', title: 'No-pressure follow-up',
    line: "I'll check back, but if your answer's still no, that's totally fine — just tell me and I'll stop.",
    whyItWorks: "Naming the off-ramp upfront makes customers more likely to engage honestly.",
    psychology: 'Reverse Psychology', tags: ['follow-up', 'empathy', 'trust'] },
  { id: 'fu_008', category: 'Follow-Up', title: 'Value-add follow-up',
    line: "When I call back I'll bring two things — the updated quote and a tip for the carpenter ant trail you mentioned.",
    whyItWorks: "Each follow-up should deliver new value, not just re-ask the same question.",
    psychology: 'Reciprocity', tags: ['follow-up', 'reciprocity', 'value'] },
  { id: 'fu_009', category: 'Follow-Up', title: 'Soft persistence',
    line: "I'll check back a couple times over the season. Tell me when you'd rather I stop — happy to honor it.",
    whyItWorks: "Setting expectations of persistence with a clear off-ramp is honest and effective.",
    psychology: 'Transparency', tags: ['follow-up', 'relationship', 'commitment'] },
  { id: 'fu_010', category: 'Follow-Up', title: 'Frame the wait as professional',
    line: "I won't pester. I'll check back exactly twice — once next week, once next month — and then I'll let it go unless you reach out.",
    whyItWorks: "Bounded persistence respects the customer and stays on the calendar.",
    psychology: 'Transparency', tags: ['follow-up', 'trust', 'commitment'] },

  // ── COMMERCIAL SALES ────────────────────────────────────────────────────
  { id: 'cmrl_001', category: 'Commercial Sales', title: 'Risk to operations',
    line: "For a business, one pest sighting in front of a customer can do more damage than a year of prevention costs.",
    whyItWorks: "Commercial decision-makers weigh operational risk heavily.",
    psychology: 'Loss Aversion', tags: ['commercial', 'loss', 'risk'] },
  { id: 'cmrl_002', category: 'Commercial Sales', title: 'Inspection-record value',
    line: "We keep service records the health inspector can pull up in two clicks. That's worth as much as the treatment.",
    whyItWorks: "Commercial buyers value documentation and audit-trail as much as the work itself.",
    psychology: 'Value Stacking', tags: ['commercial', 'value', 'authority'] },
  { id: 'cmrl_003', category: 'Commercial Sales', title: 'After-hours scheduling',
    line: "We can schedule treatments outside your operating hours so there's zero impact on customers or staff.",
    whyItWorks: "Convenience and continuity matter more in commercial sales than residential.",
    psychology: 'Friction Removal', tags: ['commercial', 'value', 'differentiation'] },
  { id: 'cmrl_004', category: 'Commercial Sales', title: 'Multi-location pricing',
    line: "If you've got more than one location, we can build a single agreement that covers all of them with one invoice.",
    whyItWorks: "Operational simplicity is a strong commercial value driver.",
    psychology: 'Convenience Framing', tags: ['commercial', 'value', 'differentiation'] },
  { id: 'cmrl_005', category: 'Commercial Sales', title: 'Compliance-driven framing',
    line: "If you're inspected — food service, hospitality, healthcare — our service is built around what those inspectors look for.",
    whyItWorks: "Tying the service to compliance reduces price negotiation entirely.",
    psychology: 'Authority', tags: ['commercial', 'authority', 'value'] },
  { id: 'cmrl_006', category: 'Commercial Sales', title: 'Dedicated point of contact',
    line: "You'll have one direct contact — no shuffle between departments. If something's off, one call fixes it.",
    whyItWorks: "Commercial buyers value escalation simplicity.",
    psychology: 'Relationship Selling', tags: ['commercial', 'relationship', 'trust'] },
  { id: 'cmrl_007', category: 'Commercial Sales', title: 'Reputation risk',
    line: "One online review mentioning a pest is six months of brand recovery. The plan costs less than the cleanup.",
    whyItWorks: "Reputation-cost framing speaks directly to a commercial decision-maker's incentives.",
    psychology: 'Loss Aversion', tags: ['commercial', 'loss', 'social'] },
  { id: 'cmrl_008', category: 'Commercial Sales', title: 'Trial period for commercial',
    line: "First quarter is essentially a trial. If we're not catching issues your current vendor would, we don't continue.",
    whyItWorks: "Lowering the commitment ask is critical in commercial sales where switching is painful.",
    psychology: 'Risk Reversal', tags: ['commercial', 'risk', 'switching'] },
  { id: 'cmrl_009', category: 'Commercial Sales', title: 'Reference accounts',
    line: "We do work for a few similar businesses in town. Want me to put you in touch with one for a reference?",
    whyItWorks: "Reference accounts are the strongest commercial trust signal there is.",
    psychology: 'Social Proof', tags: ['commercial', 'social', 'trust'] },
  { id: 'cmrl_010', category: 'Commercial Sales', title: 'Long-term partnership framing',
    line: "We're not pitching a one-year contract — we're pitching a long-term partner who'll be on your team year over year.",
    whyItWorks: "Commercial buyers prefer long-term reliability over short-term wins.",
    psychology: 'Relationship Selling', tags: ['commercial', 'relationship', 'value'] },

  // ── RESIDENTIAL SALES ───────────────────────────────────────────────────
  { id: 'res_001', category: 'Residential Sales', title: 'Kids and pets first',
    line: "Before anything else — I want to make sure what we use is safe for the kids and the dog. That's the first question I'd want answered.",
    whyItWorks: "Leading with safety pre-empts the most common residential objection.",
    psychology: 'Empathy', tags: ['residential', 'trust', 'empathy'] },
  { id: 'res_002', category: 'Residential Sales', title: 'Property as biggest asset',
    line: "This is probably the biggest investment you own. Pest prevention is one of the cheapest ways to protect it.",
    whyItWorks: "Framing pest control against home value justifies the recurring spend.",
    psychology: 'Framing', tags: ['residential', 'frame', 'value'] },
  { id: 'res_003', category: 'Residential Sales', title: 'Outdoor enjoyment frame',
    line: "Most of our families tell us the real win is finally being able to use the yard again without thinking about it.",
    whyItWorks: "Lifestyle outcomes weigh heavier than technical features for residential customers.",
    psychology: 'Outcome Selling', tags: ['residential', 'value', 'mosquito'] },
  { id: 'res_004', category: 'Residential Sales', title: 'Local neighbor proof',
    line: "We treat properties up and down this block. If you want me to point at a few that started with the same concerns, I can.",
    whyItWorks: "Hyper-local social proof is incredibly persuasive for residential buyers.",
    psychology: 'Social Proof', tags: ['residential', 'social', 'trust'] },
  { id: 'res_005', category: 'Residential Sales', title: 'Family-decision framing',
    line: "If your spouse wants to be part of this — totally fine, I'd recommend it. I can come back tomorrow when you can talk together.",
    whyItWorks: "Honoring the family decision dynamic prevents 'I need to talk to my spouse' from killing the deal.",
    psychology: 'Empathy', tags: ['residential', 'empathy', 'decision'] },
  { id: 'res_006', category: 'Residential Sales', title: 'Same-tech promise',
    line: "You'll have the same tech most visits. That matters for a home — somebody who knows the layout, the pets, the kids' schedule.",
    whyItWorks: "Continuity is a residential trust signal that's hard for big companies to replicate.",
    psychology: 'Relationship Selling', tags: ['residential', 'relationship', 'trust'] },
  { id: 'res_007', category: 'Residential Sales', title: 'Memory of past summers',
    line: "Think about last summer — were there nights you wanted to be outside and couldn't because of mosquitos?",
    whyItWorks: "Recalling lived pain is more persuasive than predicting future pain.",
    psychology: 'Loss Aversion', tags: ['residential', 'mosquito', 'discovery'] },
  { id: 'res_008', category: 'Residential Sales', title: 'Frame as quiet, not invasive',
    line: "Most of the time we treat, you won't even notice we were here. It's set up to be invisible.",
    whyItWorks: "Residential customers worry about disruption — name it and dissolve it.",
    psychology: 'Friction Removal', tags: ['residential', 'consultative', 'value'] },
  { id: 'res_009', category: 'Residential Sales', title: 'Surprise-call frame',
    line: "If something pops up between visits, you call us — no charge, no questions. That's not a feature, that's the standard.",
    whyItWorks: "Stating the guarantee as a baseline (not a perk) raises the expectation.",
    psychology: 'Risk Reversal', tags: ['residential', 'guarantee', 'trust'] },
  { id: 'res_010', category: 'Residential Sales', title: 'Address the door-to-door skepticism',
    line: "I know — somebody at the door is the last thing you want today. I'll keep this to ten minutes and respect your time.",
    whyItWorks: "Acknowledging the awkward dynamic upfront defuses defensiveness.",
    psychology: 'Empathy', tags: ['residential', 'opening', 'empathy'] },

  // ── MOSQUITO ────────────────────────────────────────────────────────────
  { id: 'mos_001', category: 'Mosquito', title: 'Backyard pain frame',
    line: "How many nights last summer did you give up on being outside because of mosquitos?",
    whyItWorks: "Surfaces the actual lived pain, which is the real reason to buy.",
    psychology: 'Loss Aversion', tags: ['mosquito', 'discovery', 'residential'] },
  { id: 'mos_002', category: 'Mosquito', title: 'Tick-and-Lyme combo',
    line: "Mosquito treatment also knocks down tick populations — and we're in a part of the country where Lyme is real.",
    whyItWorks: "Bundling tick-and-Lyme messaging adds urgency to the mosquito conversation.",
    psychology: 'Value Stacking', tags: ['mosquito', 'value', 'risk'] },
  { id: 'mos_003', category: 'Mosquito', title: 'Treatment cadence frame',
    line: "We treat monthly from May through October. That's the window where mosquito populations actually breed and spread.",
    whyItWorks: "Showing seasonal expertise establishes authority and matches the customer's real summer.",
    psychology: 'Authority', tags: ['mosquito', 'seasonal', 'authority'] },
  { id: 'mos_004', category: 'Mosquito', title: 'Yard-perimeter approach',
    line: "We treat the perimeter and the spots mosquitos rest — under decks, edges of woods, dense shrubs. Not the open yard.",
    whyItWorks: "Showing precision in the approach distinguishes from spray-and-pray amateurs.",
    psychology: 'Authority', tags: ['mosquito', 'authority', 'differentiation'] },
  { id: 'mos_005', category: 'Mosquito', title: 'Pet-and-kid safety',
    line: "Everything dries within thirty minutes. After that, kids and pets are fine in the yard.",
    whyItWorks: "Safety reassurance pre-empts the most common mosquito-treatment objection.",
    psychology: 'Pre-empting Objections', tags: ['mosquito', 'trust', 'residential'] },
  { id: 'mos_006', category: 'Mosquito', title: 'Cost-per-summer-night',
    line: "Across a summer, monthly mosquito treatment works out to about a dollar per usable backyard night.",
    whyItWorks: "Per-night pricing reframes the cost against the value the customer actually cares about.",
    psychology: 'Price Reframing', tags: ['mosquito', 'price', 'value'] },

  // ── RODENTS ─────────────────────────────────────────────────────────────
  { id: 'rod_001', category: 'Rodents', title: 'Damage to wiring',
    line: "Rodents chew through wiring. The repair on a single chewed line can cost more than a year of prevention.",
    whyItWorks: "Concrete property-damage framing makes the spend feel cheap.",
    psychology: 'Loss Aversion', tags: ['rodents', 'loss', 'value'] },
  { id: 'rod_002', category: 'Rodents', title: 'Health-risk frame',
    line: "Rodents carry diseases — that's not pest control marketing, that's the CDC. One nest in the wall is a health issue.",
    whyItWorks: "Health risk for rodents is harder to ignore than aesthetic concerns.",
    psychology: 'Loss Aversion', tags: ['rodents', 'loss', 'risk', 'residential'] },
  { id: 'rod_003', category: 'Rodents', title: 'Once-they\'re-in frame',
    line: "Mice don't really leave. Once they're in, they breed — fast. Prevention is way cheaper than removal.",
    whyItWorks: "Reproductive math makes prevention feel inevitable and timely.",
    psychology: 'Urgency', tags: ['rodents', 'urgency', 'prevention'] },
  { id: 'rod_004', category: 'Rodents', title: 'Exclusion approach',
    line: "Most of the work isn't bait — it's sealing entry points so they can't get back in.",
    whyItWorks: "Distinguishing professional exclusion from amateur trapping establishes expertise.",
    psychology: 'Authority', tags: ['rodents', 'authority', 'differentiation'] },
  { id: 'rod_005', category: 'Rodents', title: 'Pre-winter urgency',
    line: "Rodent activity spikes when temperatures drop. Treating now means we're closing the doors before they come looking.",
    whyItWorks: "Seasonal urgency for rodents is genuine and well-understood.",
    psychology: 'Urgency', tags: ['rodents', 'urgency', 'seasonal'] },
  { id: 'rod_006', category: 'Rodents', title: 'Property-value frame',
    line: "A rodent issue is one of the fastest ways to fail a home inspection. Prevention protects resale value.",
    whyItWorks: "Linking rodents to home value adds a high-stakes frame.",
    psychology: 'Loss Aversion', tags: ['rodents', 'loss', 'residential'] },

  // ── BED BUGS ────────────────────────────────────────────────────────────
  { id: 'bed_001', category: 'Bed Bugs', title: 'Don\'t shame, normalize',
    line: "Bed bugs aren't a cleanliness issue. They hitch rides on travel, secondhand furniture, anything. The smartest people I know have dealt with them.",
    whyItWorks: "Normalizing bed bugs removes shame and lets the customer engage honestly.",
    psychology: 'Empathy', tags: ['bedbugs', 'empathy', 'trust'] },
  { id: 'bed_002', category: 'Bed Bugs', title: 'Treatment certainty',
    line: "We use a two-phase treatment with a fourteen-day follow-up. By visit two, the population is gone in 95% of homes.",
    whyItWorks: "Specific success rates project confidence in a category where customers are often desperate.",
    psychology: 'Authority', tags: ['bedbugs', 'authority', 'guarantee'] },
  { id: 'bed_003', category: 'Bed Bugs', title: 'Pre-treatment prep',
    line: "We'll give you a one-page prep list. The more you do beforehand, the more effective treatment is.",
    whyItWorks: "Naming the prep upfront sets expectations and frames the customer as a partner.",
    psychology: 'Consultative Selling', tags: ['bedbugs', 'consultative', 'trust'] },
  { id: 'bed_004', category: 'Bed Bugs', title: 'Discretion frame',
    line: "Our trucks aren't labeled bed bugs. Neighbors won't know what we're treating.",
    whyItWorks: "Privacy concerns are real for bed bug clients — naming and addressing them builds trust.",
    psychology: 'Empathy', tags: ['bedbugs', 'empathy', 'trust'] },
  { id: 'bed_005', category: 'Bed Bugs', title: 'Speed-to-treat',
    line: "Every day matters with bed bugs. Earlier we treat, less spread, fewer rooms involved.",
    whyItWorks: "Speed urgency for bed bugs is real and well-understood by customers.",
    psychology: 'Urgency', tags: ['bedbugs', 'urgency', 'closing'] },

  // ── GENERAL PEST ────────────────────────────────────────────────────────
  { id: 'gen_001', category: 'General Pest', title: 'One service, all the common stuff',
    line: "Quarterly handles the everyday stuff — ants, spiders, wasps, mice perimeter — without you having to call for each one.",
    whyItWorks: "Bundling the common pests under one umbrella simplifies the decision.",
    psychology: 'Value Stacking', tags: ['generalpest', 'value', 'residential'] },
  { id: 'gen_002', category: 'General Pest', title: 'Prevention over reaction',
    line: "The quarterly plan isn't about chasing problems — it's about not having them in the first place.",
    whyItWorks: "Reframes the value from treatment to prevention.",
    psychology: 'Framing', tags: ['generalpest', 'frame', 'prevention'] },
  { id: 'gen_003', category: 'General Pest', title: 'Common entry points',
    line: "Most general-pest issues start at the same five entry points. We treat all of them every visit.",
    whyItWorks: "Specificity in the approach signals expertise.",
    psychology: 'Authority', tags: ['generalpest', 'authority', 'differentiation'] },
  { id: 'gen_004', category: 'General Pest', title: 'Seasonal cycling',
    line: "Each visit targets the species active that season — spring carpenter ants, summer wasps, fall mice, winter spiders.",
    whyItWorks: "Showing the seasonal logic explains why recurring service is necessary.",
    psychology: 'Authority', tags: ['generalpest', 'seasonal', 'value'] },
  { id: 'gen_005', category: 'General Pest', title: 'Re-service guarantee for general',
    line: "If anything pops up between quarterly visits, we come back at no charge. That's the deal — pay once a quarter, see us as much as you need.",
    whyItWorks: "Naming the guarantee as part of the plan reinforces the value-stacking.",
    psychology: 'Risk Reversal', tags: ['generalpest', 'guarantee', 'value'] },
  { id: 'gen_006', category: 'General Pest', title: 'Outside-in approach',
    line: "We treat the outside perimeter so pests don't make it inside in the first place. Most companies treat reactively from the inside.",
    whyItWorks: "Differentiating the approach explains the price difference.",
    psychology: 'Differentiation', tags: ['generalpest', 'authority', 'differentiation'] },
  { id: 'gen_007', category: 'General Pest', title: 'Catch-the-pattern framing',
    line: "By visit three we've usually mapped the property's pest patterns — which corners, which seasons, which species. The plan adjusts to that.",
    whyItWorks: "Frames recurring service as an intelligence-gathering investment.",
    psychology: 'Value Stacking', tags: ['generalpest', 'value', 'consultative'] },
  { id: 'gen_008', category: 'General Pest', title: 'One-stop-shop',
    line: "Instead of calling a different company every time something new pops up — one plan, one number, one tech.",
    whyItWorks: "Convenience consolidation is its own value driver.",
    psychology: 'Convenience Framing', tags: ['generalpest', 'value', 'relationship'] },

  // ── ANNUAL PLANS ────────────────────────────────────────────────────────
  { id: 'ann_001', category: 'Annual Plans', title: 'Annual budgeting',
    line: "Annual pricing locks the rate for the full year. No price changes mid-season, no surprises.",
    whyItWorks: "Budget certainty is a real value driver for residential customers.",
    psychology: 'Risk Reversal', tags: ['annual', 'value', 'price'] },
  { id: 'ann_002', category: 'Annual Plans', title: 'Annual vs. monthly framing',
    line: "Annual works out cheaper than monthly across the year — and we don't bill you monthly if you don't want.",
    whyItWorks: "Reframing payment cadence as flexibility, not a contract requirement.",
    psychology: 'Friction Removal', tags: ['annual', 'price', 'value'] },
  { id: 'ann_003', category: 'Annual Plans', title: 'Long-horizon commitment',
    line: "Pest control is inherently year-round. The plan just matches the reality.",
    whyItWorks: "Reframing the year-round commitment as honest matching of the problem.",
    psychology: 'Framing', tags: ['annual', 'frame', 'value'] },
  { id: 'ann_004', category: 'Annual Plans', title: 'Annual coverage cycle',
    line: "Across the year we treat for four to six different species depending on season. One plan covers all of them.",
    whyItWorks: "Naming the breadth of pests covered annually justifies the commitment.",
    psychology: 'Value Stacking', tags: ['annual', 'value', 'seasonal'] },
  { id: 'ann_005', category: 'Annual Plans', title: 'Annual relationship',
    line: "An annual plan means the tech learns your property over the year. By visit four, they're ahead of you on what to watch for.",
    whyItWorks: "Frames the annual commitment as an investment in expertise specific to the customer.",
    psychology: 'Relationship Selling', tags: ['annual', 'relationship', 'value'] },
  { id: 'ann_006', category: 'Annual Plans', title: 'Skip-month flexibility',
    line: "Annual doesn't mean inflexible. If you need to skip a month — vacation, scheduling, anything — we work around it.",
    whyItWorks: "Pre-empts the commitment objection by stating the flexibility upfront.",
    psychology: 'Pre-empting Objections', tags: ['annual', 'commitment', 'risk'] },
  { id: 'ann_007', category: 'Annual Plans', title: 'Annual peace of mind',
    line: "The biggest thing customers say about year-round plans is they finally stop thinking about it.",
    whyItWorks: "Outcome framing emphasizes the lived benefit of the commitment.",
    psychology: 'Outcome Selling', tags: ['annual', 'value', 'residential'] },
  { id: 'ann_008', category: 'Annual Plans', title: 'No-renewal-trap',
    line: "Annual doesn't auto-renew into a multi-year contract. End of the year, you choose to keep going or not.",
    whyItWorks: "Removing the auto-renewal fear is critical for customers burned by other vendors.",
    psychology: 'Risk Reversal', tags: ['annual', 'risk', 'trust'] },

  // ── SEASONAL SELLING ────────────────────────────────────────────────────
  { id: 'sea_001', category: 'Seasonal Selling', title: 'Spring start advantage',
    line: "Starting in spring gets you ahead of the buildup. By summer the populations are five times bigger.",
    whyItWorks: "Biological seasonality is real and persuasive.",
    psychology: 'Urgency', tags: ['seasonal', 'urgency', 'authority'] },
  { id: 'sea_002', category: 'Seasonal Selling', title: 'Off-season savings',
    line: "Starting in the off-season locks the best pricing — and gets you treated before everyone else needs us.",
    whyItWorks: "Off-season starts have real operational and pricing benefits.",
    psychology: 'Scarcity', tags: ['seasonal', 'price', 'scarcity'] },
  { id: 'sea_003', category: 'Seasonal Selling', title: 'Fall rodent push',
    line: "Fall is when rodents look for warmth. We treat the perimeter before they show up at the threshold.",
    whyItWorks: "Naming the specific seasonal pressure makes the timing concrete.",
    psychology: 'Urgency', tags: ['seasonal', 'rodents', 'urgency'] },
  { id: 'sea_004', category: 'Seasonal Selling', title: 'Winter is for inspection',
    line: "Winter visits are about inspection — catching the entry points and conditions that drive the spring problem.",
    whyItWorks: "Naming the winter strategy justifies year-round service.",
    psychology: 'Authority', tags: ['seasonal', 'authority', 'prevention'] },
  { id: 'sea_005', category: 'Seasonal Selling', title: 'Mosquito-only seasonal',
    line: "If you only care about summer mosquitos, we have a five-month plan that runs May through October. Nothing extra.",
    whyItWorks: "Right-sized seasonal plans match the customer's actual problem.",
    psychology: 'Consultative Selling', tags: ['seasonal', 'mosquito', 'value'] },
  { id: 'sea_006', category: 'Seasonal Selling', title: 'Get-ahead pricing',
    line: "Pre-season pricing is locked at last year's rate. Once the season starts, pricing typically moves up.",
    whyItWorks: "Real pre-season pricing creates honest urgency.",
    psychology: 'Scarcity', tags: ['seasonal', 'price', 'urgency'] },
  { id: 'sea_007', category: 'Seasonal Selling', title: 'Carpenter ants in May',
    line: "Carpenter ants surface in May. Treat now and you'll see almost none. Wait and you're chasing them through July.",
    whyItWorks: "Species-specific seasonal urgency is real and verifiable.",
    psychology: 'Urgency', tags: ['seasonal', 'urgency', 'generalpest'] },
  { id: 'sea_008', category: 'Seasonal Selling', title: 'Tick window',
    line: "Ticks become active when soil temperature hits a certain point — usually three weeks from now. The window matters.",
    whyItWorks: "Biological timing creates real urgency without manufactured pressure.",
    psychology: 'Authority', tags: ['seasonal', 'mosquito', 'authority'] },

  // ── QUESTION-BASED SELLING ──────────────────────────────────────────────
  { id: 'qbs_001', category: 'Question-Based Selling', title: 'Open with a question, not a pitch',
    line: "Mind if I ask what made you open the door today instead of just waving me off?",
    whyItWorks: "Surfaces the customer's motivation immediately and frames the rep as curious, not pushy.",
    psychology: 'Discovery', tags: ['discovery', 'opening'] },
  { id: 'qbs_002', category: 'Question-Based Selling', title: 'The implication question',
    line: "If this got worse — what does that look like for you?",
    whyItWorks: "Forces the customer to name the cost of inaction in their own words.",
    psychology: 'SPIN — Implication', tags: ['discovery', 'loss'] },
  { id: 'qbs_003', category: 'Question-Based Selling', title: 'The need-payoff question',
    line: "If we solved this, what does that free you up to do?",
    whyItWorks: "Makes the customer articulate the upside themselves — more persuasive than the rep doing it.",
    psychology: 'SPIN — Need-Payoff', tags: ['discovery', 'value', 'closing'] },
  { id: 'qbs_004', category: 'Question-Based Selling', title: 'The clarifying question',
    line: "Just to make sure I understand — when you say 'sometimes,' what's that look like in a typical week?",
    whyItWorks: "Surfaces specifics and prevents the rep from solving the wrong problem.",
    psychology: 'Discovery', tags: ['discovery', 'consultative'] },
  { id: 'qbs_005', category: 'Question-Based Selling', title: 'The reverse question',
    line: "If you were in my shoes, what would you want to ask?",
    whyItWorks: "Hands the conversational power back to the customer, which often surfaces real concerns.",
    psychology: 'Discovery', tags: ['discovery', 'empathy', 'consultative'] },
  { id: 'qbs_006', category: 'Question-Based Selling', title: 'The future-state question',
    line: "Twelve months from now, what would have had to be true for this to feel like the right call?",
    whyItWorks: "Future-tense success questions surface the customer's real criteria for satisfaction.",
    psychology: 'SPIN — Need-Payoff', tags: ['discovery', 'value', 'closing'] },
  { id: 'qbs_007', category: 'Question-Based Selling', title: 'The yes-question stack',
    line: "Do you want to protect the property? Do you want to stop thinking about pests? Do you want pricing that doesn't move on you? Then quarterly is the right fit.",
    whyItWorks: "Stacked easy-yes questions build momentum into the recommendation.",
    psychology: 'Commitment & Consistency', tags: ['discovery', 'closing', 'commitment'] },
  { id: 'qbs_008', category: 'Question-Based Selling', title: 'The blocker question',
    line: "What's the one thing that, if we addressed it, would make this an easy decision?",
    whyItWorks: "Isolates the single blocking concern — usually fixable.",
    psychology: 'Objection Isolation', tags: ['discovery', 'closing'] },

  // ── CONFIDENCE & CONVICTION ─────────────────────────────────────────────
  { id: 'conf_001', category: 'Confidence', title: 'State the recommendation directly',
    line: "Based on what I see, quarterly is the right call. I'd recommend it to my own family.",
    whyItWorks: "Direct, personal recommendations land much harder than 'here are some options.'",
    psychology: 'Authority', tags: ['conviction', 'authority', 'closing'] },
  { id: 'conf_002', category: 'Confidence', title: 'Don\'t over-explain',
    line: "Short version — this works, you'll see results in two visits, and the rate stays the same all year.",
    whyItWorks: "Over-explaining signals uncertainty. Confidence is brief.",
    psychology: 'Authority', tags: ['conviction', 'authority', 'closing'] },
  { id: 'conf_003', category: 'Confidence', title: 'Don\'t apologize for the price',
    line: "The price is the price. It reflects what's actually included. I won't apologize for it.",
    whyItWorks: "Apologizing for price invites negotiation. Owning it raises perceived value.",
    psychology: 'Conviction', tags: ['conviction', 'authority', 'price'] },
  { id: 'conf_004', category: 'Confidence', title: 'Make the ask',
    line: "I'd like to get you on the schedule. Want me to do that now?",
    whyItWorks: "Most sales are lost because nobody asked. Asking directly is the close.",
    psychology: 'Direct Close', tags: ['conviction', 'closing', 'commitment'], curated: true  },
  { id: 'conf_005', category: 'Confidence', title: 'Hold the silence',
    line: "[Ask the closing question — then stop talking. Let the silence do the work.]",
    whyItWorks: "Silence after a close is uncomfortable for the customer, not the rep. Whoever speaks first usually loses.",
    psychology: 'Closing Tactic', tags: ['conviction', 'closing', 'discovery'] },
  { id: 'conf_006', category: 'Confidence', title: 'Speak with diagnostic certainty',
    line: "This is a moisture-driven carpenter ant pattern. I'd bet money on it.",
    whyItWorks: "Confidence in the diagnosis signals expertise more powerfully than any credential.",
    psychology: 'Authority', tags: ['conviction', 'authority', 'discovery'] },
  { id: 'conf_007', category: 'Confidence', title: 'Decline weak offers',
    line: "I'm not going to discount this just to close it today. The price is fair — and so is the work.",
    whyItWorks: "Refusing to discount when pushed signals quality and conviction.",
    psychology: 'Conviction', tags: ['conviction', 'price', 'authority'] },
  { id: 'conf_008', category: 'Confidence', title: 'Skip the soft language',
    line: "I'd say — I'd recommend — I think you should. Pick the one that's most direct.",
    whyItWorks: "Hedging language ('maybe,' 'I think,' 'kind of') signals uncertainty. Direct verbs sell.",
    psychology: 'Conviction', tags: ['conviction', 'authority', 'closing'] },
];

// ══════════════════════════════════════════════════════════════════════════
//   KNOWLEDGE ENGINE
//   Indexes, helpers, rotation, picking, search.
//   Keep all business logic here. Components import named exports only.
// ══════════════════════════════════════════════════════════════════════════

// ── Indexes (built lazily once on first use) ────────────────────────────

let _idIndex          = null;   // id → insight
let _categoryIndex    = null;   // category → insight[]
let _tagIndex         = null;   // tag → insight[]
let _psychologyIndex  = null;   // psychology → insight[]
let _categoriesCache  = null;   // string[] in insertion order
let _curatedCache     = null;   // insight[]

function ensureIndexes() {
  if (_idIndex) return;
  _idIndex         = new Map();
  _categoryIndex   = new Map();
  _tagIndex        = new Map();
  _psychologyIndex = new Map();
  const catOrder   = [];
  const seenCats   = new Set();
  const curated    = [];

  for (const i of INSIGHTS) {
    _idIndex.set(i.id, i);

    if (!seenCats.has(i.category)) { seenCats.add(i.category); catOrder.push(i.category); }
    pushIntoMap(_categoryIndex, i.category, i);

    if (i.psychology) pushIntoMap(_psychologyIndex, i.psychology, i);

    if (Array.isArray(i.tags)) {
      for (const t of i.tags) pushIntoMap(_tagIndex, t, i);
    }

    if (i.curated) curated.push(i);
  }

  _categoriesCache = catOrder;
  _curatedCache    = curated;
}

function pushIntoMap(map, key, value) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

// Resolve all default ranking fields. Lightweight — returns a new object
// only when defaults are applied; otherwise returns the original by ref.
function withDefaults(i) {
  if (
    i.priority      != null &&
    i.confidence    != null &&
    i.difficulty    != null &&
    i.effectiveness != null &&
    i.curated       != null
  ) return i;
  return {
    ...i,
    priority:      i.priority      ?? DEFAULT_PRIORITY,
    confidence:    i.confidence    ?? DEFAULT_CONFIDENCE,
    difficulty:    i.difficulty    ?? DEFAULT_DIFFICULTY,
    effectiveness: i.effectiveness ?? DEFAULT_EFFECTIVENESS,
    curated:       i.curated       ?? false,
  };
}

// ── Rotation tracking (persisted across reloads) ─────────────────────────

const REC_IDS_KEY   = 'oc.intel.recent';        // historical key — kept for compat
const REC_CATS_KEY  = 'oc.intel.recentCats';
const REC_PSYCH_KEY = 'oc.intel.recentPsych';

const REC_IDS_MAX   = 40;
const REC_CATS_MAX  = 8;
const REC_PSYCH_MAX = 6;

function loadList(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function saveList(key, arr, max) {
  try { localStorage.setItem(key, JSON.stringify(arr.slice(0, max))); }
  catch { /* localStorage may be unavailable */ }
}

function pushRecent(insight) {
  if (!insight) return;
  saveList(REC_IDS_KEY,   [insight.id,        ...loadList(REC_IDS_KEY).filter(x => x !== insight.id)],          REC_IDS_MAX);
  saveList(REC_CATS_KEY,  [insight.category,  ...loadList(REC_CATS_KEY).filter(x => x !== insight.category)],   REC_CATS_MAX);
  saveList(REC_PSYCH_KEY, [insight.psychology,...loadList(REC_PSYCH_KEY).filter(x => x !== insight.psychology)],REC_PSYCH_MAX);
}

// ── Scoring (variety + quality) ──────────────────────────────────────────

function scoreCandidate(insight, ctx) {
  const i = withDefaults(insight);
  let score = (i.priority * i.confidence) + (i.effectiveness * 0.5);
  if (i.curated) score *= CURATED_BOOST;

  // Penalize recent categories (proximity-weighted)
  const catIdx = ctx.recentCats.indexOf(i.category);
  if      (catIdx === 0) score *= 0.22;
  else if (catIdx === 1) score *= 0.50;
  else if (catIdx === 2) score *= 0.72;
  else if (catIdx >= 0)  score *= 0.88;

  // Penalize recent psychology labels
  const psyIdx = ctx.recentPsych.indexOf(i.psychology);
  if      (psyIdx === 0) score *= 0.40;
  else if (psyIdx === 1) score *= 0.65;
  else if (psyIdx >= 0)  score *= 0.85;

  // Profile-driven nudges (all optional)
  if (ctx.profile) {
    if (ctx.profile.preferredCategories?.includes(i.category)) score *= 1.25;
    if (ctx.profile.bookmarks?.includes(i.id))                 score *= 0.55; // already seen + liked → spread elsewhere
    if (ctx.profile.ratings?.[i.id] === 'up')                  score *= 1.15;
    if (ctx.profile.ratings?.[i.id] === 'down')                score *= 0.40;
    // Skill-level shapes which difficulty surfaces
    if (ctx.profile.skillLevel === 'new'           && i.difficulty >= 4) score *= 0.65;
    if (ctx.profile.skillLevel === 'experienced'   && i.difficulty <= 2) score *= 0.80;
  }

  return score;
}

function weightedRandomFrom(scored) {
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  // Take top 30% but always at least 6 candidates if pool is large enough
  const sliceSize = Math.max(Math.min(6, scored.length), Math.ceil(scored.length * 0.30));
  const top = scored.slice(0, sliceSize);
  const total = top.reduce((s, c) => s + c.score, 0);
  if (total <= 0) return top[0].insight;
  let r = Math.random() * total;
  for (const c of top) {
    r -= c.score;
    if (r <= 0) return c.insight;
  }
  return top[0].insight;
}

function applyProfileFilters(pool, profile) {
  if (!profile) return pool;
  const hiddenIds = profile.hiddenIds?.length ? new Set(profile.hiddenIds) : null;
  const hiddenCats = profile.hiddenCategories?.length ? new Set(profile.hiddenCategories) : null;
  if (!hiddenIds && !hiddenCats) return pool;
  return pool.filter(i =>
    (!hiddenIds  || !hiddenIds.has(i.id)) &&
    (!hiddenCats || !hiddenCats.has(i.category))
  );
}

function poolFromTags(tags) {
  if (!tags || tags.length === 0) return INSIGHTS;
  ensureIndexes();
  const seen = new Set();
  const out  = [];
  for (const t of tags) {
    const bucket = _tagIndex.get(t);
    if (!bucket) continue;
    for (const i of bucket) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      out.push(i);
    }
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
//   Public API — core lookup
// ══════════════════════════════════════════════════════════════════════════

/** Return an insight by id, or null if not found. O(1). */
export function getInsightById(id) {
  ensureIndexes();
  return _idIndex.get(id) || null;
}

/** Return all categories in insertion order. Memoized. */
export function getCategories() {
  ensureIndexes();
  return _categoriesCache.slice();
}

/** Total number of insights in the library. */
export function getInsightCount() {
  return INSIGHTS.length;
}

/** Return every insight (defensive copy of the array). */
export function getAllInsights() {
  return INSIGHTS.slice();
}

/** Curated insights (admin-featured). Memoized. */
export function getCuratedInsights() {
  ensureIndexes();
  return _curatedCache.slice();
}

/** Insights in a specific category. Empty array if none. */
export function getInsightsByCategory(category) {
  ensureIndexes();
  return (_categoryIndex.get(category) || []).slice();
}

/** Insights labeled with a specific psychology principle. */
export function getInsightsByPsychology(psychology) {
  ensureIndexes();
  return (_psychologyIndex.get(psychology) || []).slice();
}

/** Insights matching any of the given tags. Deduped. */
export function getInsightsByTags(tags) {
  return poolFromTags(Array.isArray(tags) ? tags : [tags]);
}

// ══════════════════════════════════════════════════════════════════════════
//   Public API — picking (with smart rotation + scoring)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Pick an insight, optionally biased by objection category and/or user profile.
 * Returns the same insight only when the entire pool has been recently shown.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.objectionCategory]  key from OBJECTION_TAG_MAP
 * @param {string}  [opts.excludeId]          never return this exact insight
 * @param {object}  [opts.profile]            optional user profile (see header)
 */
export function pickInsight({ objectionCategory = null, excludeId = null, profile = null } = {}) {
  ensureIndexes();
  const recentIds   = new Set(loadList(REC_IDS_KEY));
  const recentCats  = loadList(REC_CATS_KEY);
  const recentPsych = loadList(REC_PSYCH_KEY);

  // Determine pool
  let pool = INSIGHTS;
  if (objectionCategory && OBJECTION_TAG_MAP[objectionCategory]?.length) {
    const filtered = poolFromTags(OBJECTION_TAG_MAP[objectionCategory]);
    if (filtered.length > 0) pool = filtered;
  }
  pool = applyProfileFilters(pool, profile);

  // Hard-exclude recents (with graceful fallback)
  let eligible = pool.filter(i => !recentIds.has(i.id) && i.id !== excludeId);
  if (eligible.length === 0) eligible = pool.filter(i => i.id !== excludeId);
  if (eligible.length === 0) eligible = pool;

  const scored = eligible.map(insight => ({
    insight,
    score: scoreCandidate(insight, { recentCats, recentPsych, profile }),
  }));

  const picked = weightedRandomFrom(scored) || INSIGHTS[0];
  pushRecent(picked);
  return picked;
}

/** Pick an insight forced to a given category. Respects rotation + profile. */
export function pickInsightByCategory(category, opts = {}) {
  ensureIndexes();
  const pool = _categoryIndex.get(category);
  if (!pool || pool.length === 0) return null;
  return pickFromPool(pool, opts);
}

/** Pick an insight matching any of the supplied tags. */
export function pickInsightByTags(tags, opts = {}) {
  const pool = poolFromTags(Array.isArray(tags) ? tags : [tags]);
  if (pool.length === 0) return null;
  return pickFromPool(pool, opts);
}

function pickFromPool(pool, { excludeId = null, profile = null } = {}) {
  const recentIds   = new Set(loadList(REC_IDS_KEY));
  const recentCats  = loadList(REC_CATS_KEY);
  const recentPsych = loadList(REC_PSYCH_KEY);

  let working = applyProfileFilters(pool, profile);
  let eligible = working.filter(i => !recentIds.has(i.id) && i.id !== excludeId);
  if (eligible.length === 0) eligible = working.filter(i => i.id !== excludeId);
  if (eligible.length === 0) eligible = working.length ? working : pool;

  const scored = eligible.map(insight => ({
    insight,
    score: scoreCandidate(insight, { recentCats, recentPsych, profile }),
  }));
  const picked = weightedRandomFrom(scored) || pool[0];
  pushRecent(picked);
  return picked;
}

/** Pure random pick — bypasses rotation + scoring. Useful for tests / previews. */
export function getRandomInsight() {
  return INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)];
}

/**
 * Personalized recommendation pipeline.
 * Today: alias of pickInsight({ profile }). Reserved as the future entry
 * point for ML-ranked or server-recommended insights so callers can adopt
 * the name now and the implementation can swap underneath.
 */
export function getRecommendedInsight(profile = null, opts = {}) {
  return pickInsight({ ...opts, profile });
}

// ══════════════════════════════════════════════════════════════════════════
//   Public API — discovery
// ══════════════════════════════════════════════════════════════════════════

/**
 * Full-text search over title / line / whyItWorks / psychology / category.
 * Case-insensitive, ranked by where the match landed (title > line > body).
 */
export function searchInsights(query, { limit = 25 } = {}) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const scored = [];
  for (const i of INSIGHTS) {
    let score = 0;
    if (i.title.toLowerCase().includes(q))       score += 5;
    if (i.category.toLowerCase().includes(q))    score += 4;
    if (i.psychology?.toLowerCase().includes(q)) score += 3;
    if (i.line.toLowerCase().includes(q))        score += 2;
    if (i.whyItWorks.toLowerCase().includes(q))  score += 1;
    if (i.tags?.some(t => t.includes(q)))        score += 2;
    if (score > 0) scored.push({ insight: i, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.insight);
}

/**
 * Find insights related to the given one by shared tags + psychology.
 * Returns at most `limit` insights, excluding the source.
 */
export function getRelatedInsights(insightId, { limit = 4 } = {}) {
  ensureIndexes();
  const src = _idIndex.get(insightId);
  if (!src) return [];
  const srcTags = new Set(src.tags || []);
  const scored = [];
  for (const i of INSIGHTS) {
    if (i.id === src.id) continue;
    let score = 0;
    if (i.psychology === src.psychology) score += 3;
    if (i.category   === src.category)   score += 2;
    for (const t of (i.tags || [])) if (srcTags.has(t)) score += 1;
    if (score > 0) scored.push({ insight: i, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.insight);
}

/** Library statistics — useful for an admin view or dev sanity check. */
export function getStats() {
  ensureIndexes();
  const byCategory = {};
  for (const [cat, list] of _categoryIndex) byCategory[cat] = list.length;
  const byPsychology = {};
  for (const [psy, list] of _psychologyIndex) byPsychology[psy] = list.length;
  return {
    total:        INSIGHTS.length,
    curated:      _curatedCache.length,
    categories:   _categoriesCache.length,
    tags:         _tagIndex.size,
    psychologies: _psychologyIndex.size,
    byCategory,
    byPsychology,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//   User-state hooks — localStorage-backed; safe to call from anywhere.
//   These are the engine's writable side and the only place that touches
//   user-specific persistence. UI can build profiles by reading these.
// ══════════════════════════════════════════════════════════════════════════

const BOOKMARK_KEY = 'oc.intel.bookmarks';
const RATING_KEY   = 'oc.intel.ratings';
const HIDDEN_KEY   = 'oc.intel.hidden';
const VIEWS_KEY    = 'oc.intel.views';

// ── Bookmarks ───────────────────────────────────────────────────────────

export function bookmarkInsight(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
    if (!arr.includes(id)) arr.push(id);
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

export function unbookmarkInsight(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(arr.filter(x => x !== id)));
  } catch { /* noop */ }
}

export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'); }
  catch { return []; }
}

export function isBookmarked(id) {
  return getBookmarks().includes(id);
}

export function getBookmarkableInsights() {
  // Today: every insight is bookmarkable. Reserved for future curation rules.
  return getAllInsights();
}

export function getBookmarkedInsights() {
  ensureIndexes();
  return getBookmarks().map(id => _idIndex.get(id)).filter(Boolean);
}

// ── Ratings (👍 / 👎) ────────────────────────────────────────────────────

export function rateInsight(id, rating /* 'up' | 'down' | null */) {
  try {
    const map = JSON.parse(localStorage.getItem(RATING_KEY) || '{}');
    if (rating === null) delete map[id];
    else map[id] = { rating, at: new Date().toISOString() };
    localStorage.setItem(RATING_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}

export function getRating(id) {
  try {
    const map = JSON.parse(localStorage.getItem(RATING_KEY) || '{}');
    return map[id]?.rating || null;
  } catch { return null; }
}

export function getRatings() {
  try { return JSON.parse(localStorage.getItem(RATING_KEY) || '{}'); }
  catch { return {}; }
}

// ── Hidden insights ─────────────────────────────────────────────────────

export function hideInsight(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
    if (!arr.includes(id)) arr.push(id);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

export function unhideInsight(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(arr.filter(x => x !== id)));
  } catch { /* noop */ }
}

export function getHiddenIds() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); }
  catch { return []; }
}

// ── View tracking (lightweight, for future analytics) ───────────────────

export function markViewed(id) {
  try {
    const map = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
    map[id] = (map[id] || 0) + 1;
    localStorage.setItem(VIEWS_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}

export function getViewCount(id) {
  try {
    const map = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
    return map[id] || 0;
  } catch { return 0; }
}

// ── Profile assembly helper ─────────────────────────────────────────────

/**
 * Convenience: build a profile object from localStorage state so callers
 * can pass `profile` to picking functions without managing it themselves.
 * Returns an empty profile if nothing has been recorded yet.
 */
export function getLocalProfile() {
  return {
    bookmarks: getBookmarks(),
    ratings:   getRatings(),
    hiddenIds: getHiddenIds(),
  };
}
