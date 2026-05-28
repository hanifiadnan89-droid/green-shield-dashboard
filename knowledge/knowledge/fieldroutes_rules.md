# FieldRoutes Rules

For click-by-click UI instructions (creating leads, sending agreements, scheduling), see operator_sop_fieldroutes.md. This file covers rules the AI must know and apply.

## Approved Service Types

Residential:
- Insect Quarterly
- Rodent Insect Triannual
- Bed Bug Insect Triannual
- Residential Custom

Commercial:
- Commercial Monthly
- Commercial Bi-Monthly
- Commercial Quarterly
- Commercial Triannual
- Commercial Custom

Both:
- Tick Mosquito Monthly
- One Time Service

Do NOT use:
- Holiday Lighting
- Initial Service
- Reservice
- Insect Quarterly D2D
- Rodent Insect Quarterly

## Lead Tab Rule
Do not convert a lead to a subscription unless the customer has agreed and the sale is complete. Assign to the correct sales rep before doing anything else.

## Invoice Rules
The $150 Initial Discount line on agreements must not be changed without manager approval. This is the amount the customer reimburses if they cancel before completing four visits. Canonical rule: see account_management_rules.md.

## Billing and Payment
Take card when possible. Enable autopay. Confirm billing address.

Card script:
"All right, the only thing left is to reserve a spot with any debit or credit card. It just reserves it and won't come out until the service is complete. Future payments won't start on that card until next month."

Customer may add a card online or pay by check if preferred.

## Agreement Verification Rules
Before sending an agreement, confirm: customer name, email address, initial price, recurring price, service frequency, and start date all match what was discussed. Add contract notes summarizing the agreement (example: "Ants in kitchen. Thorough baiting with all other bugs included and guaranteed.").

## Owner, Tenant, and Landlord Rules
- Owner should be present for initial quarterly, rodent, and bed bug services.
- Tick/Mosquito initial: owner does not need to be home but should provide a home/meter photo or be reachable by phone.
- If tenant pays: written landlord permission required before treating. Upload authorization to the account.
- Landlord/out-of-town owner: Welcome Letter must be signed online before treatment begins.

## AI Limitation and Fallback
Unless the AI has confirmed FieldRoutes tool access, it must NOT claim to have:
- Created or updated an account
- Scheduled an appointment
- Converted or frozen a subscription
- Sent an agreement
- Applied a discount or changed pricing

If the AI cannot perform a FieldRoutes action, it should respond with:
"I can check that for you."
Or prepare a customer-facing draft message for Adnan to review and send manually.
