/**
 * Sales Coach Engine — Strategy layer for all Sales Coach modules.
 *
 * Each module (objectionCoach, pricingCoach, closingCoach, etc.) maps to one
 * exported async function: run<ModuleName>(params).
 *
 * Routes in ai.js dispatch to these functions by module name.
 * Static knowledge is loaded once via loadOAKnowledge(); dynamic case
 * retrieval is handled by objectionKnowledge.js and never overrides static rules.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  loadOAKnowledge,
  getRelevantExamplesWithFallback,
  formatExamplesForPrompt,
} from './objectionKnowledge.js';

// Lazy Anthropic client — fails only when first used, not at startup
let _anthropic = null;
function getClient() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to server/.env.');
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

function parseCoachJson(raw) {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(clean);
}

// ── Module 1: Objection Coach ─────────────────────────────────────────────────

function buildObjectionCoachSystemPrompt() {
  return `You are a senior sales coach at Green Shield Pest Solutions. A field rep is asking for coaching on a live sales situation.

Your job is to deliver a complete coaching package — not just a script. Give the rep everything they need: the words to say, the psychology behind it, the strategy, and the pitfalls.

GREEN SHIELD SERVICES AND PRICING:
- Tick & Mosquito Monthly (T/M): ~$119–$169/month depending on acreage, May–October. Monthly outdoor tick and mosquito treatments.
- Integrated Quarterly (IQ): $399 initial, $59/month (up to 3,000 sq ft). Year-round exterior pest control, every 3 months.
- RIT Rodent Insect Triannual: $449 initial, $65/month. Rodent baiting + exclusion + general insects.
- BIT Bed Bug Triannual: $599 initial, $65/month. 14-day follow-up included.
- Re-service Guarantee: free re-service if pests return between visits.
- Safety: products are family and pet friendly once dry (~30 minutes).

CUSTOMER PERSONALITY GUIDANCE:
- Analytical: lead with data and specifics. Explain the why behind every step.
- Budget Conscious / Price-Focused: break down cost per day/month, cost of inaction, guarantee removes financial risk.
- Friendly / Chatty: warm connection, personal story or empathy first, then value.
- In a Rush: be concise. Respect their time. One-sentence value prop, fast close.
- Skeptical: earned trust first. Guarantee, local reputation, no long-term lock-in.

COACHING PRINCIPLES (use all that apply):
- Value stacking: remind them what $119/month actually buys
- Cost of inaction: Lyme disease, mosquito illness, pest damage
- Risk reduction: the guarantee removes financial risk
- Urgency: seasonal window, booking availability
- Closing: always end with a direct question that moves toward yes

OUTPUT — return ONLY valid JSON with exactly these 7 keys. No markdown, no extra text:
{
  "recommendedResponse": "3–5 sentences the rep says aloud. Phone-ready. Warm, confident, not scripted. Acknowledges the objection, reframes value, ties to their situation, ends with a direct close question. No filler phrases.",
  "whyThisWorks": "2–3 sentences explaining the psychology — why this specific approach works for this customer type and objection. What mental shift does it create in the customer?",
  "salesStrategy": "2–3 sentences of strategic coaching for the rep — what leverage exists here, what the customer's real underlying concern likely is, and how to use it.",
  "softerVersion": "3–4 sentence alternative for a more hesitant or emotional customer — same objective, more empathetic tone, gentler close. Ends with a question.",
  "bestClosingQuestion": "The single most effective closing question for this exact situation — one sentence, direct, designed to either get a yes or surface the real blocking concern.",
  "thingsToAvoid": ["3–5 specific phrases or approaches the rep should NOT use in this situation"],
  "confidence": a number from 0 to 100 — how confident the coaching is given the available context. High context and clear objection = 85–95. Low context or ambiguous = 45–65.
}`;
}

function buildObjectionCoachUserMessage(situation, category, service, personality, propertyContext, leadContext, knowledge, examples) {
  const lines = [];

  if (knowledge) {
    lines.push('SALES COACH KNOWLEDGE BASE:');
    lines.push(knowledge);
    lines.push('');
  }

  const examplesText = formatExamplesForPrompt(examples);
  if (examplesText) {
    lines.push(examplesText);
    lines.push('');
  }

  lines.push('SITUATION:');
  lines.push(`"${situation}"`);
  lines.push('');

  if (category)    lines.push(`Objection category: ${category}`);
  if (service)     lines.push(`Service being discussed: ${service}`);
  if (personality) lines.push(`Customer personality type: ${personality}`);

  if (propertyContext && Object.values(propertyContext).some(Boolean)) {
    lines.push('');
    lines.push('PROPERTY CONTEXT:');
    if (propertyContext.address)      lines.push(`- Address: ${propertyContext.address}`);
    if (propertyContext.propertyType) lines.push(`- Property type: ${propertyContext.propertyType}`);
    if (propertyContext.acreage)      lines.push(`- Approx acreage: ${propertyContext.acreage}`);
    if (propertyContext.notes)        lines.push(`- Notes: ${propertyContext.notes}`);
  }

  if (leadContext?.pricing || leadContext?.notes) {
    lines.push('');
    lines.push('LEAD CONTEXT:');
    if (leadContext.pricing) lines.push(`- Pricing discussed: ${leadContext.pricing}`);
    if (leadContext.notes)   lines.push(`- Notes: ${leadContext.notes}`);
  }

  lines.push('');
  lines.push('Provide the complete coaching package. Return only valid JSON with all 7 keys.');
  return lines.join('\n');
}

/**
 * Module 1: Objection Coach
 *
 * @param {{ situation, category, service, personality, propertyContext, leadContext, sessionId }} params
 * @returns {Promise<CoachObjectionResult>}
 */
export async function runObjectionCoach({ situation, category = null, service = null, personality = null, propertyContext = {}, leadContext = {}, sessionId = null }) {
  const oaKnowledge = loadOAKnowledge();
  const examples    = await getRelevantExamplesWithFallback(situation, { serviceType: service, ...propertyContext });
  const userMessage = buildObjectionCoachUserMessage(
    situation, category, service, personality,
    propertyContext, leadContext, oaKnowledge, examples,
  );

  const aiResponse = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1100,
    system: buildObjectionCoachSystemPrompt(),
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = (aiResponse.content[0]?.text || '').trim();

  let parsed;
  try {
    parsed = parseCoachJson(raw);
  } catch {
    throw new Error('AI returned an unexpected format. Please try again.');
  }

  return {
    recommendedResponse: (parsed.recommendedResponse || '').trim(),
    whyThisWorks:        (parsed.whyThisWorks        || '').trim(),
    salesStrategy:       (parsed.salesStrategy       || '').trim(),
    softerVersion:       (parsed.softerVersion       || '').trim(),
    bestClosingQuestion: (parsed.bestClosingQuestion  || '').trim(),
    thingsToAvoid:       Array.isArray(parsed.thingsToAvoid)
      ? parsed.thingsToAvoid.map(s => String(s).trim()).filter(Boolean)
      : [],
    confidence: typeof parsed.confidence === 'number'
      ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
      : 70,
    sessionId: sessionId || null,
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
// Future modules plug in here. Each gets its own run<Module> function above.

const MODULE_HANDLERS = {
  objectionCoach: runObjectionCoach,
  // pricingCoach:   runPricingCoach,   // coming soon
  // closingCoach:   runClosingCoach,   // coming soon
  // followUpCoach:  runFollowUpCoach,  // coming soon
  // callStrategy:   runCallStrategy,   // coming soon
  // playbooks:      runPlaybooks,      // coming soon
};

export function getSupportedModules() {
  return Object.keys(MODULE_HANDLERS);
}

/**
 * Dispatch to the correct module engine.
 *
 * @param {string} module  — e.g. 'objectionCoach'
 * @param {object} params  — forwarded to the module handler
 */
export async function runSalesCoachModule(module, params) {
  const handler = MODULE_HANDLERS[module];
  if (!handler) {
    throw Object.assign(new Error(`Unknown Sales Coach module: ${module}`), { code: 'UNKNOWN_MODULE' });
  }
  return handler(params);
}
