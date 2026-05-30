# Lead Context Schema

This file defines what structured data must be injected into the AI when generating a reply. The AI must receive this context in every draft-reply call. Do not generate a reply without at minimum: name, phone, lead_stage, follow_up_step, and last_customer_message or notes.

## Required Fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Customer's full name |
| `phone` | string | Primary phone number |
| `email` | string | Email address if known |
| `town` | string | Town or city |
| `address` | string | Street address if available |
| `reason` | string | Why the customer reached out (e.g., "ants in kitchen", "mice in basement") |
| `pest_type` | string | Primary pest reported (e.g., ants, rodents, ticks, bed bugs, wasps, wildlife) |
| `lead_source` | string | Where the lead came from — Angi, GMB, LSA, SAS, CI, MSG, Baton, Yelp, website, other |
| `lead_stage` | string | Current stage in the sales pipeline — see Lead Stage Options below |
| `status` | string | CRM status label if different from stage (e.g., open, closed, won, lost) |
| `notes` | string | Internal CRM notes (yellow/red notes) visible to the AI for context |
| `sms_reply` | boolean | Whether the customer has replied via SMS |
| `email_reply` | boolean | Whether the customer has replied via email |
| `last_customer_message` | string | Full text of the customer's most recent inbound message |
| `prior_chat_history` | array | Previous message exchanges in chronological order |
| `last_contacted_at` | datetime | Timestamp of last outbound contact attempt |
| `follow_up_step` | string | Which step in the follow-up sequence this draft is for — see Follow-Up Step Options below |
| `agreement_sent` | boolean | Whether a FieldRoutes agreement link has been sent |
| `quote_sent` | boolean | Whether a price quote has been given verbally or in writing |
| `scheduled_date` | date | Appointment date if confirmed in FieldRoutes |
| `scheduled_window` | string | Arrival window (e.g., AM, PM, Anytime, 8–12, call-ahead) |
| `preferred_contact_method` | string | Customer's preferred channel: SMS, email, or call |
| `stop` | boolean | Whether the customer has sent a STOP or opt-out keyword |
| `reply_archived` | boolean | Whether this reply thread has been archived |
| `route_availability_context` | string | Output from Route Finder tool if available — route days, tech zone, open windows |
| `human_review_required` | boolean | Whether this draft must be reviewed by a human before sending |
| `property_type` | string | Type of property: single_family, duplex, multi_unit, apartment, business, restaurant, office, warehouse, other |
| `is_commercial` | boolean | Whether the account is commercial (any non-single-family property) |
| `square_feet` | number | Approximate square footage of the property — used for IQ/RIT/BIT residential pricing and business commercial pricing |
| `cleared_acreage` | number | Cleared acreage of the property — used for TMM tick and mosquito pricing |
| `unit_count` | number | Number of units in a multi-unit building — used for commercial multi-unit pricing |
| `commercial_type` | string | Sub-type for commercial accounts: multi_unit, business, restaurant, warehouse, other |
| `service_type_requested` | string | What service the customer is asking about: IQ, RIT, TMM, BIT, OTS, SPE, commercial, unknown |
| `reply_count` | number | Total number of back-and-forth exchanges in this conversation so far |
| `buying_signal` | string | Strength of buying intent: strong, moderate, unclear, resistant, not_interested |
| `needs_human_review` | boolean | Alias for human_review_required — flag if AI detects a sensitive scenario |
| `pricing_context` | string | Free-text summary of what pricing has already been discussed with the customer |

## Lead Stage Options

| Stage | Meaning |
|---|---|
| `new_lead` | Just received, no outreach attempted yet |
| `no_answer` | Outreach attempted, customer has not responded |
| `contacted` | Two-way contact established, conversation is active |
| `quote_sent` | Price was given verbally or via text, no agreement sent yet |
| `agreement_sent` | FieldRoutes agreement link sent, awaiting customer signature |
| `customer_replied` | Customer sent an inbound message that needs a response |
| `interested` | Customer expressed interest but is not ready to close yet |
| `needs_price` | Customer asked for pricing, no quote given yet |
| `needs_scheduling` | Customer agreed to service, no appointment set yet |
| `scheduled` | Appointment confirmed in FieldRoutes |
| `already_serviced` | Customer is active — this was a false follow-up trigger |
| `not_interested` | Customer declined service |
| `stopped` | Customer sent STOP or another opt-out keyword |
| `archived` | Conversation closed and filed |
| `escalation_required` | Human must handle — AI must not auto-draft |

## Follow-Up Step Options

| Step | When to Use |
|---|---|
| `initial_outreach` | First contact attempt on a brand-new lead |
| `follow_up_1` | First follow-up after no response to initial outreach |
| `follow_up_2` | Second follow-up, usually the last standard attempt |
| `final_follow_up` | Final attempt before marking as not_interested |
| `agreement_follow_up` | Follow-up after agreement was sent but not signed |
| `no_answer_follow_up` | Follow-up specifically noting a missed call or voicemail was left |

## Lead Source Definitions

| Code | Meaning |
|---|---|
| Angi | Lead from Angi (formerly Angie's List) |
| CI | Call-in — customer called the office directly |
| GMB | Google My Business message or review lead |
| LSA | Google Local Services Ads |
| SAS | Answering service (after-hours calls) |
| MSG | Direct message via SMS or other platform |
| Baton | Baton referral platform |
| Yelp | Yelp inquiry |
| website | Green Shield website contact form |
| other | Any source not listed above |

## AI Pricing Context Rules

Use these fields to determine which pricing table to apply:

| Scenario | Required Field | Pricing Table |
|---|---|---|
| TMM (tick/mosquito) | `cleared_acreage` | TMM acreage table in services_and_pricing.md |
| Residential IQ/RIT/BIT | `square_feet` | Residential sq ft table in services_and_pricing.md |
| Multi-unit commercial | `unit_count` | Table 1 in commercial_pricing_rules.md |
| Business commercial | `square_feet` + `commercial_type` | Table 2 in commercial_pricing_rules.md |
| Exterior rodent baiting | `unit_count` or station estimate | Exterior baiting section in commercial_pricing_rules.md |

If the required field is null or unknown, ask for it before quoting. One question at a time.

## AI Behavior Rules Based on Context

- If `stop` is true: do not generate a sales reply. Flag for human review immediately.
- If `human_review_required` or `needs_human_review` is true: generate draft but label it clearly as requiring human approval before sending.
- If `lead_stage` is `escalation_required`: do not draft. Output: "This lead requires human review — do not send automated reply."
- If `lead_stage` is `already_serviced`: use the already-serviced template. Do not pitch.
- If `lead_stage` is `scheduled`: confirm appointment details. Do not re-pitch from scratch.
- If `agreement_sent` is true and customer has not replied: use `agreement_follow_up` step.
- If `route_availability_context` is empty or null: do not reference specific dates or windows. Use general availability language only.
- If `last_customer_message` is empty and step is not `initial_outreach`: check `prior_chat_history` before drafting.
- If `preferred_contact_method` is email: follow email style rules. If SMS or unknown: follow SMS style rules.
- If `is_commercial` is true: use commercial_pricing_rules.md for any pricing. Do not quote residential rates.
- If `pest_type` is wildlife: do not pitch pest control. Refer to Baton Services (207-813-2376).
- If `reply_count` is available and above 15: the AI may continue if `buying_signal` is strong or moderate. Do not force the close.
- If `service_type_requested` is TMM and `cleared_acreage` is null: ask for acreage before quoting.
- If `service_type_requested` is IQ/RIT/BIT and `square_feet` is null: ask for home size before quoting precisely.
