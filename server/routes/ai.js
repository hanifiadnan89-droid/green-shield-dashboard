import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { loadKnowledge } from '../services/knowledge.js';
import {
  loadOAKnowledge,
  appendFeedback,
  getRelevantExamplesWithFallback,
  formatExamplesForPrompt,
} from '../services/objectionKnowledge.js';

const router = express.Router();

// Lazy-init so missing API key only fails on actual use, not server startup
let anthropic = null;
function getClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to server/.env to enable AI Draft Reply.');
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// Keywords in the customer message that always trigger human review
const ESCALATION_PATTERNS = [
  /\brefund\b/i,
  /\bcancel\b/i,
  /\b(angry|furious|upset|pissed off|anger)\b/i,
  /\bbad review\b/i,
  /\byelp\b/i,
  /\bgoogle review\b/i,
  /\b(lawyer|attorney|legal action|sue|lawsuit)\b/i,
  /\b(sick|ill|hospital|doctor|allergic|allergy|chemical reaction|poisoned|toxic)\b/i,
  /\b(pregnant|pregnancy|newborn|infant)\b/i,
  /\bdiscount\b/i,
  /\b(competitor|cheaper|other company|beat that price)\b/i,
  /\bcomplaint\b/i,
  /\b(technician complaint|tech was|tech didn't|your guy)\b/i,
  /\b(landlord|tenant|renter|my landlord|my tenant)\b/i,
];

function detectEscalation(context) {
  const msg = (context.last_customer_message || '').toLowerCase();

  if (context.stop) {
    return { required: true, reason: 'Customer has opted out (STOP received). Do not send any messages.' };
  }
  if (context.lead_stage === 'escalation_required') {
    return { required: true, reason: 'Lead is flagged for human escalation.' };
  }
  if (context.human_review_required) {
    return { required: true, reason: 'Lead was already flagged for human review.' };
  }

  for (const pattern of ESCALATION_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        required: true,
        reason: `Customer message contains a sensitive topic that needs human review before responding.`,
      };
    }
  }

  return { required: false, reason: null };
}

function buildAssistSystemPrompt(knowledge) {
  return `You are the AI Response Assistant for Green Shield Pest Solutions — an interactive copilot inside the Replies inbox (like ChatGPT embedded in the CRM).

Adnan types instructions describing how he wants to respond. You write the SMS (or email-style) reply text based on HIS instructions plus the conversation context already provided. You do NOT choose strategy or tone unless he asks.

KNOWLEDGE BASE — follow all rules in these files:
${knowledge}

RULES:
1. Follow the user's instruction precisely (tone, length, content, language, number of versions).
2. Default output: 1–4 sentences, SMS-ready, human and direct — unless the user asks otherwise.
3. Voice: Adnan at Green Shield Pest Solutions — professional, calm, friendly, not pushy.
4. Never invent pricing, availability, specific dates, technician names, guarantees, or discounts not in the knowledge base.
5. You already have the full thread and latest customer message — never ask Adnan to repeat what the customer said.
6. If CURRENT REPLY DRAFT is provided, treat rewrite/shorten/professional prompts as edits to that text unless told otherwise.
7. For "create 3 versions" or similar, put all versions in the draft field, clearly labeled (Version 1:, Version 2:, etc.).
8. For translate/summarize tasks, put the result in draft (summary can be slightly longer).
9. Escalation topics in the latest customer message (anger, refund, cancel, legal, health, bad review, discount demand): set human_review_required true and explain in review_reason.
10. Do not add a sign-off unless the user requests it or this is clearly first contact.

OUTPUT — respond ONLY with valid JSON. No markdown fences, no extra text:
{
  "draft": "text to place in the reply compose box",
  "human_review_required": false,
  "review_reason": null
}`;
}

function buildSystemPrompt(knowledge) {
  return `You are the AI reply assistant for Green Shield Pest Solutions. Your only job is to draft a short SMS reply that Adnan will review and approve before sending. You never send anything automatically.

KNOWLEDGE BASE — read and follow all rules in these files:
${knowledge}

DRAFTING RULES:
1. SMS style: 1 to 4 sentences. Short, direct, human-sounding. Never corporate.
2. Voice: Adnan with Green Shield Pest Solutions — professional, calm, friendly, not pushy.
3. Never invent: pricing, availability, specific dates, appointment times, technician names, guarantees, or discounts not in the knowledge base.
4. If route_availability_context is null or empty: do not name specific dates or times. Use "our next available opening" or "I can check what we have open on our end."
5. If pest_type is unknown: ask what pests they're dealing with before pitching a service.
6. If the customer message involves an escalation topic (anger, refund, cancel, safety, health, legal, bad review, technician complaint, discount demand): set human_review_required to true and explain why in review_reason.
7. Use only pricing from services_and_pricing.md. If not enough info to quote accurately, ask a clarifying question instead.
8. Do not add sign-off ("Adnan / Green Shield") unless this is the initial_outreach step — existing customers already know who you are.
9. Keep it conversational, not scripted. Avoid filler phrases like "I hope this message finds you well."

ESCALATION TRIGGERS — always set human_review_required: true if any of these appear:
- Anger, complaint, refund request, threat of bad review
- Safety or health concerns (allergy, chemical reaction, illness, pregnancy)
- Legal mention (lawyer, sue, attorney)
- Cancel or stop request
- Discount demand outside normal rules
- Technician complaint
- Landlord or tenant dispute

OUTPUT — respond ONLY with valid JSON. No explanation, no markdown, just the JSON object:
{
  "draft": "the SMS text here",
  "human_review_required": false,
  "review_reason": null
}`;
}

function buildUserMessage(context) {
  const lines = [
    `LEAD CONTEXT:`,
    `- Name: ${context.name || 'Unknown'}`,
    `- Phone: ${context.phone || 'Unknown'}`,
    `- Email: ${context.email || 'None on file'}`,
    `- Town: ${context.town || 'Unknown'}`,
    `- Address: ${context.address || 'Not provided'}`,
    `- Reason they contacted us: ${context.reason || 'Not specified'}`,
    `- Pest type: ${context.pest_type || 'Unknown — may need to ask'}`,
    `- Lead source: ${context.lead_source || 'Unknown'}`,
    `- Lead stage: ${context.lead_stage || 'customer_replied'}`,
    `- CRM status: ${context.status || 'Unknown'}`,
    `- Internal notes: ${context.notes || 'None'}`,
    `- Has replied via SMS: ${context.sms_reply ? 'Yes' : 'No'}`,
    `- Has replied via email: ${context.email_reply ? 'Yes' : 'No'}`,
    `- Last contacted at: ${context.last_contacted_at || 'Unknown'}`,
    `- Follow-up step: ${context.follow_up_step || 'follow_up_1'}`,
    `- Agreement sent: ${context.agreement_sent ? 'Yes' : 'No'}`,
    `- Quote sent: ${context.quote_sent ? 'Yes' : 'No'}`,
    `- Scheduled date: ${context.scheduled_date || 'Not scheduled'}`,
    `- Scheduled window: ${context.scheduled_window || 'None'}`,
    `- Preferred contact method: ${context.preferred_contact_method || 'SMS'}`,
    `- Customer STOP flag: ${context.stop ? 'YES — do not message' : 'No'}`,
    `- Route availability context: ${context.route_availability_context || 'Not available — do not name specific dates'}`,
  ];

  const history = context.conversation_history?.length
    ? context.conversation_history
    : (context.prior_chat_history || []).map(m => ({
        role: m.role || 'agent',
        text: m.text,
        ts: m.ts,
        channel: m.channel || 'sms',
      }));

  if (history.length > 0) {
    lines.push('');
    lines.push('FULL CONVERSATION (oldest to newest):');
    history.forEach((m, i) => {
      const who = m.role === 'customer' ? 'Customer' : 'Adnan (us)';
      const ch = m.channel ? ` [${m.channel}]` : '';
      const ts = m.ts ? ` ${m.ts}` : '';
      lines.push(`  ${i + 1}. ${who}${ch}${ts}: ${m.text}`);
    });
  }

  lines.push('');
  lines.push(`CUSTOMER'S LATEST MESSAGE:`);
  lines.push(context.last_customer_message || '(no inbound message yet)');

  return lines.join('\n');
}

function buildAssistUserMessage(context, userPrompt, currentDraft) {
  const lines = [buildUserMessage(context)];
  lines.push('');
  if (currentDraft?.trim()) {
    lines.push('CURRENT REPLY DRAFT (in compose box — use for rewrite/edit prompts):');
    lines.push(currentDraft.trim());
    lines.push('');
  }
  lines.push('ADNAN\'S INSTRUCTION (follow exactly):');
  lines.push(userPrompt.trim());
  lines.push('');
  lines.push('Write the reply text for the compose box per the instruction. Return only valid JSON.');
  return lines.join('\n');
}

function parseAiJson(raw) {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch {
    return {
      draft: raw,
      human_review_required: true,
      review_reason: 'AI response was not valid JSON — review before sending.',
    };
  }
}

async function runAssist({ lead_context, user_prompt, current_draft }) {
  const escalation = detectEscalation(lead_context);
  if (escalation.required && lead_context.stop) {
    return {
      draft: '',
      human_review_required: true,
      review_reason: escalation.reason,
    };
  }

  const knowledge = loadKnowledge();
  const systemPrompt = buildAssistSystemPrompt(knowledge);
  const userMessage = buildAssistUserMessage(lead_context, user_prompt, current_draft);

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0]?.text?.trim() || '{}';
  const parsed = parseAiJson(raw);

  return {
    draft: (parsed.draft || '').trim(),
    human_review_required: escalation.required || parsed.human_review_required || false,
    review_reason: escalation.reason || parsed.review_reason || null,
  };
}

router.post('/assist-reply', async (req, res) => {
  try {
    const { lead_context, user_prompt, current_draft } = req.body;

    if (!lead_context) {
      return res.status(400).json({ error: 'Missing lead_context in request body.' });
    }
    if (!lead_context.name || !lead_context.phone) {
      return res.status(400).json({ error: 'lead_context must include at least name and phone.' });
    }
    const prompt = (user_prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ error: 'Describe how you would like to respond (user_prompt is required).' });
    }

    const result = await runAssist({
      lead_context,
      user_prompt: prompt,
      current_draft: current_draft || '',
    });
    return res.json(result);
  } catch (err) {
    console.error('[ai/assist-reply]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** @deprecated Use POST /ai/assist-reply with a user_prompt instead */
router.post('/draft-reply', async (req, res) => {
  try {
    const { lead_context } = req.body;

    if (!lead_context) {
      return res.status(400).json({ error: 'Missing lead_context in request body.' });
    }
    if (!lead_context.name || !lead_context.phone) {
      return res.status(400).json({ error: 'lead_context must include at least name and phone.' });
    }

    const escalation = detectEscalation(lead_context);
    if (escalation.required && lead_context.stop) {
      return res.json({
        draft: '',
        human_review_required: true,
        review_reason: escalation.reason,
      });
    }

    const knowledge = loadKnowledge();
    const systemPrompt = buildSystemPrompt(knowledge);
    const userMessage = `${buildUserMessage(lead_context)}\n\nTASK: Draft a reply SMS from Adnan at Green Shield Pest Solutions. Follow all rules above. Return only valid JSON.`;

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content[0]?.text?.trim() || '{}';
    const parsed = parseAiJson(raw);

    return res.json({
      draft: (parsed.draft || '').trim(),
      human_review_required: escalation.required || parsed.human_review_required || false,
      review_reason: escalation.reason || parsed.review_reason || null,
    });
  } catch (err) {
    console.error('[ai/draft-reply]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Objection Assistant ────────────────────────────────────────────────────

function buildObjectionSystemPrompt() {
  return `You are a Green Shield Pest Solutions sales rep on a live phone call with a residential customer.

The customer raised an objection. Write a spoken response using this 4-step structure:
1. Acknowledge — one sentence showing you heard them (don't dismiss or over-validate)
2. Reframe value — one or two sentences repositioning the service benefit or cost
3. Tie to their property — one sentence connecting to their specific property, pest pressure, or service conditions
4. Close — one direct closing line that moves toward booking or a yes (e.g. "Want me to go ahead and lock you in?" or similar — keep it natural)

Rules:
- Short enough to read aloud on a phone call — 4 sentences total, no more
- No big paragraphs — each step is its own sentence or two
- Sound like a real person, not a script. Warm, confident, not pushy
- No filler phrases like "I completely understand" or "That's a great question"
- Don't name competitors
- End with a clear, direct closing line — not vague, not soft
- Return ONLY the spoken response text, nothing else`;
}

// ── Sales Coach (structured 3-section objection response) ──────────────────

function buildSalesCoachSystemPrompt() {
  return `You are a high-conviction sales coach embedded inside the Green Shield Pest Solutions field rep CRM. Your job: give the rep the exact words and strategy to handle a customer objection or hesitation on a live sales call — right now, in real time.

GREEN SHIELD SERVICES AND PRICING:
- Tick & Mosquito Monthly (T/M): $119/month, May–October (6-month seasonal program). Monthly outdoor tick and mosquito treatments. Ideal for families and properties with yard activity.
- Integrated Quarterly (IQ): $119/quarter, year-round exterior pest control. 4 annual treatments covering ants, wasps, spiders, stink bugs, millipedes, and general pests.
- Re-service Guarantee: If pests return between scheduled visits, Green Shield returns at no charge.
- Licensed technicians. EPA-registered products. No surprise charges.

OBJECTION HANDLING PRINCIPLES — apply whichever fit the situation:
• VALUE STACKING: $119/month isn't just a spray — it's monthly property protection, professional-grade products unavailable retail, a licensed tech who knows their yard, and a guarantee. That's peace of mind per month.
• COST OF INACTION: Ticks carry Lyme disease. One infected bite can mean months of treatment and thousands in medical bills. Mosquitoes carry illness. An untreated season creates conditions that are harder to control the following year.
• RISK REDUCTION: Green Shield guarantees results. If it doesn't work, they come back — free. There is no financial risk.
• URGENCY: Tick and mosquito season runs May–October. Every week they wait is a week of unprotected exposure. Booking slots fill up during peak season.
• CLOSING LANGUAGE: Always end with a direct, warm close. Not "think about it" — "Want me to lock you in for Saturday?" or "Can I put you down for next week?"

OUTPUT FORMAT — return ONLY valid JSON, exactly these 3 keys, no extra text, no markdown fences:
{
  "recommendedResponse": "3–5 sentences the rep says aloud. Phone-ready. Confident, warm, not pushy. Acknowledges the objection, reframes value or addresses the concern, ties to their specific property or situation, ends with a direct close question.",
  "salesAngle": "2–3 sentence internal coaching note for the rep — NOT spoken to the customer. What is the real concern behind this objection? What is the leverage point? Why does the recommended approach work here?",
  "softerVersion": "3–4 sentence alternative response for a more hesitant or cautious customer. More empathetic, less direct pressure. Still ends with a gentle close question."
}

RULES:
- recommendedResponse and softerVersion: spoken aloud on a phone call — short, human, natural
- salesAngle: internal rep coaching — strategic, concise, honest
- No filler phrases: "I completely understand", "That's a great question", "Absolutely", "Of course"
- Never name competitors or make claims not grounded in the knowledge base
- Use property, weather, or service context when available — specific responses outperform generic ones
- Never discount pricing below listed rates
- Always end both response versions with a direct closing question — not "just let me know" or "feel free to reach out"`;
}

function buildSalesCoachUserMessage(propertyContext = {}, leadContext = {}, repQuestion, knowledge = '', examples = []) {
  const lines = [];

  if (knowledge) {
    lines.push('SALES COACH KNOWLEDGE BASE (ground all responses in these rules):');
    lines.push(knowledge);
    lines.push('');
  }

  const examplesText = formatExamplesForPrompt(examples);
  if (examplesText) {
    lines.push(examplesText);
    lines.push('');
  }

  lines.push('PROPERTY CONTEXT:');

  if (propertyContext.customerName) lines.push(`- Customer: ${propertyContext.customerName}`);
  if (propertyContext.address)      lines.push(`- Address: ${propertyContext.address}`);
  if (propertyContext.propertyType) lines.push(`- Property type: ${propertyContext.propertyType}`);
  if (propertyContext.serviceType)  lines.push(`- Service type: ${propertyContext.serviceType}`);

  if (propertyContext.treatmentAcreage != null) {
    lines.push(`- Treatment area: ~${propertyContext.treatmentAcreage} acres`);
  } else if (propertyContext.treatmentSquareFeet != null) {
    const acres = (propertyContext.treatmentSquareFeet / 43560).toFixed(2);
    lines.push(`- Treatment area: ~${acres} acres (${Number(propertyContext.treatmentSquareFeet).toLocaleString()} sq ft)`);
  }

  if (propertyContext.weather) {
    const w = propertyContext.weather;
    const conds = [];
    if (w.temperatureF != null)          conds.push(`${w.temperatureF}°F`);
    if (w.rainProbabilityPercent != null) conds.push(`${w.rainProbabilityPercent}% rain`);
    if (w.windSpeedMph != null)           conds.push(`${w.windSpeedMph} mph wind`);
    if (conds.length) lines.push(`- Weather: ${conds.join(', ')}`);
  }

  if (propertyContext.suitability?.label) {
    lines.push(`- Service suitability: ${propertyContext.suitability.label}`);
  }

  lines.push('');
  lines.push('LEAD CONTEXT:');

  if (leadContext.pricing)          lines.push(`- Pricing offered: ${leadContext.pricing}`);
  if (leadContext.leadNotes)        lines.push(`- Sales notes: ${leadContext.leadNotes}`);
  if (leadContext.previousMessage)  lines.push(`- Previous customer message: ${leadContext.previousMessage}`);
  if (leadContext.recommendations)  lines.push(`- Service recommendations: ${leadContext.recommendations}`);

  const hasLeadContext = leadContext.pricing || leadContext.leadNotes || leadContext.previousMessage || leadContext.recommendations;
  if (!hasLeadContext) lines.push('- (no additional lead context)');

  lines.push('');
  lines.push('CUSTOMER OBJECTION / SITUATION:');
  lines.push(`"${repQuestion}"`);
  lines.push('');
  lines.push('Return valid JSON with recommendedResponse, salesAngle, and softerVersion. All responses must follow the knowledge base rules above.');

  return lines.join('\n');
}

router.post('/sales-coach', async (req, res) => {
  try {
    const { mode, propertyContext = {}, leadContext = {}, repQuestion } = req.body;

    if (mode !== 'objectionAssistant') {
      return res.status(400).json({ error: 'mode must be "objectionAssistant"' });
    }
    if (!repQuestion?.trim()) {
      return res.status(400).json({ error: 'repQuestion is required' });
    }

    const oaKnowledge = loadOAKnowledge();
    const examples    = await getRelevantExamplesWithFallback(repQuestion.trim());
    const userMessage = buildSalesCoachUserMessage(propertyContext, leadContext, repQuestion.trim(), oaKnowledge, examples);

    const aiResponse = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: buildSalesCoachSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = (aiResponse.content[0]?.text || '').trim();

    let parsed;
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'AI returned an unexpected format. Please try again.' });
    }

    return res.json({
      recommendedResponse: (parsed.recommendedResponse || '').trim(),
      salesAngle: (parsed.salesAngle || '').trim(),
      softerVersion: (parsed.softerVersion || '').trim(),
    });
  } catch (err) {
    console.error('[ai/sales-coach]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

function buildObjectionUserMessage(context = {}, objection) {
  const parts = [];

  if (context.customerName) parts.push(`Customer name: ${context.customerName}`);
  if (context.serviceType)   parts.push(`Service type: ${context.serviceType}`);
  if (context.address)       parts.push(`Property address: ${context.address}`);

  if (context.treatmentAcreage != null) {
    parts.push(`Treatment area: ~${context.treatmentAcreage} acres`);
  } else if (context.treatmentSquareFeet != null) {
    const acres = (context.treatmentSquareFeet / 43560).toFixed(2);
    parts.push(`Treatment area: ~${acres} acres (${Number(context.treatmentSquareFeet).toLocaleString()} sq ft)`);
  }

  if (context.weather) {
    const w = context.weather;
    const parts2 = [];
    if (w.temperatureF != null)          parts2.push(`${w.temperatureF}°F`);
    if (w.rainProbabilityPercent != null) parts2.push(`${w.rainProbabilityPercent}% rain`);
    if (w.windSpeedMph != null)           parts2.push(`${w.windSpeedMph} mph wind`);
    if (parts2.length) parts.push(`Current conditions: ${parts2.join(', ')}`);
  }

  if (context.suitability?.label) {
    parts.push(`Service suitability: ${context.suitability.label}`);
  }

  if (context.propertyType) parts.push(`Property type: ${context.propertyType}`);
  if (context.yearBuilt)    parts.push(`Year built: ${context.yearBuilt}`);

  parts.push('');
  parts.push(`Customer objection: "${objection}"`);
  parts.push('');
  parts.push('Write the phone response. 4 sentences: acknowledge → reframe value → tie to their property → direct close.');

  return parts.join('\n');
}

function buildTransformUserMessage(action, existing, objection, context = {}) {
  const instructions = {
    shorten:  'Cut this down to 2–3 sentences. Keep the acknowledge and the closing line. Drop anything that is not essential.',
    softer:   'Rewrite with a softer, more empathetic tone. More listening, less pressure. Still end with a natural closing line.',
    stronger: 'Rewrite with a stronger, more direct close. Add urgency tied to their property or the time of year. The last line should clearly push for a yes or a scheduled appointment.',
  };

  const instruction = instructions[action] || 'Improve this response.';
  const contextLine = context.customerName ? `Customer: ${context.customerName}. Objection: "${objection}".` : `Objection: "${objection}".`;

  return `${contextLine}\n\nCurrent response:\n"${existing}"\n\nInstruction: ${instruction}\n\nReturn only the rewritten response text.`;
}

router.post('/objection-assist', async (req, res) => {
  try {
    const { context = {}, objection, action = null, existing_response = '' } = req.body;

    if (!objection?.trim()) {
      return res.status(400).json({ error: 'objection is required' });
    }

    let userMessage;
    if (action && existing_response.trim()) {
      userMessage = buildTransformUserMessage(action, existing_response, objection, context);
    } else {
      userMessage = buildObjectionUserMessage(context, objection);
    }

    const aiResponse = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 350,
      system: buildObjectionSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = (aiResponse.content[0]?.text || '').trim();
    return res.json({ response: text });
  } catch (err) {
    console.error('[ai/objection-assist]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Objection feedback ─────────────────────────────────────────────────────

const VALID_FEEDBACK_TYPES = ['thumbs_up', 'thumbs_down', 'save_approved'];

router.post('/objection-feedback', async (req, res) => {
  try {
    const {
      repQuestion,
      recommendedResponse = '',
      salesAngle          = '',
      softerVersion       = '',
      feedbackType,
      correction          = null,
      propertyContext     = null,
    } = req.body;

    if (!repQuestion?.trim()) {
      return res.status(400).json({ error: 'repQuestion is required' });
    }
    if (!VALID_FEEDBACK_TYPES.includes(feedbackType)) {
      return res.status(400).json({ error: `feedbackType must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}` });
    }

    const id = await appendFeedback({
      repQuestion:         repQuestion.trim(),
      recommendedResponse: recommendedResponse.trim(),
      salesAngle:          salesAngle.trim(),
      softerVersion:       softerVersion.trim(),
      feedbackType,
      correction:          correction?.trim() || null,
      propertyContext:     propertyContext || null,
    });

    console.log(`[ai/objection-feedback] ${feedbackType} saved — id: ${id}`);
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[ai/objection-feedback]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
