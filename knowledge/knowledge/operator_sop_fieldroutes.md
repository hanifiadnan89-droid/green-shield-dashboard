# Operator SOP — FieldRoutes UI

This file contains click-by-click instructions for humans operating the FieldRoutes CRM. These steps are NOT for AI. The AI must not claim to perform these actions unless it has confirmed FieldRoutes tool access. If it cannot act, it should say "I can check that for you" or prepare a draft for Adnan to review.

---

## Creating a Lead in FieldRoutes

1. Go to the Leads tab — do not start from Accounts.
2. Create a new service record.
3. Assign to the correct sales rep.
4. Select the appropriate service type from the approved list (see fieldroutes_rules.md).
5. Set pricing per the pricing rules in services_and_pricing.md.
6. Do not convert to a subscription unless the customer has verbally agreed and the sale is complete.

---

## Sending an Agreement

1. In the lead or account record, open Documents.
2. Create a new agreement.
3. Verify before generating:
   - Customer name is correct
   - Email address is correct
   - Initial price matches what was quoted
   - Recurring price matches what was quoted
   - Service dates and frequency are correct
4. Add contract notes summarizing what was agreed (example: "Ants in kitchen. Thorough baiting with all other bugs included and guaranteed.").
5. Generate the agreement.
6. Send via email or SMS for the customer's e-signature.

---

## Scheduling an Appointment

1. Open the account in FieldRoutes.
2. Use the route map to identify the correct route day and tech zone for the customer's address.
3. Select the correct service type and link to the subscription.
4. Set the arrival window — Anytime is preferred; see scheduling_rules.md for window priority order.
5. Enable call-ahead if a tighter window was promised to the customer.
6. Add appointment notes visible to the technician (pest specifics, entry instructions, pet/owner notes).
7. Confirm the appointment date aligns with route rules for outer areas (Augusta/north of Lewiston-Auburn: Tuesday and Friday; Poland/Casco: Wednesday).

---

## Subscription Management

- Upgrade IQ → RIT: create new RIT agreement, schedule new initial service, freeze the old IQ subscription. Notify sales manager before completing to avoid double billing or commission errors.
- Add TMM bundle: create separate TMM subscription. Apply bundle discount per services_and_pricing.md.
- Never delete an old subscription — freeze it instead.
- Change of owner: create a new account for the new owner. Do not overwrite the old customer's record (privacy risk). Copy only relevant service notes.
- Multiple properties: each unique address needs its own account. Link via the Properties tab.

---

## Technician Notes

- Yellow note: internal log of sales or contact activity. Format: "SALES: MM/DD/YYYY - action taken - initials"
  Example: "SALES: 1/15/2026 - No answer, left voicemail and texted - SRC"
- Red note: visible to technician on route day. Use for pest specifics, custom treatment areas, special instructions, or commercial account details.
  Example: "PESTS: rodents and common bugs. AREAS: interior and exterior of duplex. Customer wants photos for exclusion work."
