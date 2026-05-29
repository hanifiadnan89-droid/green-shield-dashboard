import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { loadKnowledge } from '../services/knowledge.js';

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

  if (context.prior_chat_history && context.prior_chat_history.length > 0) {
    lines.push('');
    lines.push('PRIOR OUTBOUND MESSAGES (from us):');
    context.prior_chat_history.forEach((m, i) => {
      const ts = m.ts ? ` [${m.ts}]` : '';
      lines.push(`  ${i + 1}.${ts} ${m.text}`);
    });
  }

  lines.push('');
  lines.push(`CUSTOMER'S LATEST MESSAGE:`);
  lines.push(context.last_customer_message || '(no inbound message — drafting a follow-up)');

  lines.push('');
  lines.push(`TASK: Draft a reply SMS from Adnan at Green Shield Pest Solutions. Follow all rules above. Return only valid JSON.`);

  return lines.join('\n');
}

router.post('/draft-reply', async (req, res) => {
  try {
    const { lead_context } = req.body;

    if (!lead_context) {
      return res.status(400).json({ error: 'Missing lead_context in request body.' });
    }
    if (!lead_context.name || !lead_context.phone) {
      return res.status(400).json({ error: 'lead_context must include at least name and phone.' });
    }

    // Pre-flight escalation check before calling the API
    const escalation = detectEscalation(lead_context);
    if (escalation.required && lead_context.stop) {
      // Hard stop — don't even draft
      return res.json({
        draft: '',
        human_review_required: true,
        review_reason: escalation.reason,
      });
    }

    const knowledge = loadKnowledge();
    const systemPrompt = buildSystemPrompt(knowledge);
    const userMessage = buildUserMessage(lead_context);

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content[0]?.text?.trim() || '{}';

    let parsed;
    try {
      // Strip markdown code fences if Claude adds them
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // Fallback: return raw text as draft if JSON parse fails
      parsed = { draft: raw, human_review_required: true, review_reason: 'AI response was not valid JSON — review before sending.' };
    }

    // Merge pre-flight escalation result with AI result
    const finalReviewRequired = escalation.required || parsed.human_review_required || false;
    const finalReviewReason = escalation.reason || parsed.review_reason || null;

    return res.json({
      draft: (parsed.draft || '').trim(),
      human_review_required: finalReviewRequired,
      review_reason: finalReviewReason,
    });

  } catch (err) {
    console.error('[ai/draft-reply]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
