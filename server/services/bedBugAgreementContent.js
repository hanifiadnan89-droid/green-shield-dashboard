/** Static copy for the Bed Bug & Insect Triannual agreement template. */

export const BED_BUG_COMPANY = {
  name: 'Green Shield Pest Solutions',
  addressLine1: '11 Eastview Pkwy Unit 106',
  addressLine2: 'Saco, ME 04072',
  phone: '(207) 815-2284',
  email: 'service@gshieldpest.com',
  license: '85358389500',
};

export const BED_BUG_TITLE = 'Bed Bug & Insect Triannual Service Agreement';

export const BED_BUG_SERVICE_TYPE = 'BED BUG & INSECT TRIANNUAL';
export const BED_BUG_SERVICE_FREQUENCY = 'Every 120 days';

/** @deprecated Use BED_BUG_MAIN_PESTS + BED_BUG_OTHER_INCLUDED_PESTS */
export const BED_BUG_INCLUDED_PESTS = [
  'Bed Bugs',
  'Odorous Ants',
  'Pavement Ants',
  'Carpenter Ants',
  'Carpenter Bees',
  'Wasps',
  'Spiders',
  'Fall Invaders',
  'Fleas',
  'Centi/Millipedes',
  'Crickets/Earwigs',
  'Springtails/Silverfish',
];

export const BED_BUG_MAIN_PESTS = ['Bed Bugs'];

export const BED_BUG_OTHER_INCLUDED_PESTS = [
  'Odorous Ants',
  'Pavement Ants',
  'Carpenter Ants',
  'Carpenter Bees',
  'Spiders',
  'Fall Invaders',
  'Fleas',
  'Centi/Millipedes',
  'Crickets/Earwigs',
];

export const BED_BUG_ADDON_PESTS = [
  'Mice',
  'Rats',
  'Ticks/Mosquitoes',
  'Cockroaches',
];

export const BED_BUG_EXPECTATIONS_TEXT =
  'Initially you may see an increase in pest activity as pest populations are disrupted. Within a month you should see activity decline as products take effect. Over time, pest levels will continually decrease as regular services are performed. Regular service visits are marked with an "S" below.\n\n'
  + 'After the first visit, Green Shield Pest Solutions will return for a two-week follow up to inspect/treat the interior for bed bugs. After treatment will continue every 120 days for one year. We will contact you a few days before each visit by text and email.';

export const BED_BUG_AUTHORIZATION_TITLE = 'Cancellation and Payment Authorization';

export const BED_BUG_AUTHORIZATION_TEXT =
  'You, the customer, may cancel this transaction anytime prior to midnight of the third business day after the date of this transaction with written notice. If the initial service has been performed and the contract is canceled before completion, customer agrees to reimburse any discounts given on initial service. I authorize Green Shield Pest Solutions to maintain and use the payment information provided to periodically make payments for goods and services received from the Company. Payment Method may also be used for recurring payments in the amount listed above. Payments received over 45 days past due may be subject to a 4% late fee. Company requires notice at least five (5) days prior to the date of a scheduled payment in order to cancel this authorization.';

export const BED_BUG_INITIALS_TEXT =
  'Please type initials to approve this statement. I have read and agree to the terms of this agreement. I confirm my email address is correct and agree to receive this agreement and future account notices electronically. I understand that payment amounts are shown in the calendar above under the month they are due, and that "S" indicates the month(s) service will be provided.';

export const BED_BUG_AGREEMENT_PERIOD_TEXT = 'This agreement is for an initial period of 12 month(s).';

export const BED_BUG_TEMPLATE_FILENAME = 'Bed Bug.pdf';

/** Env-configurable safety gate — defaults to false unless explicitly set. */
export const BED_BUG_EMAIL_DISABLED = process.env.BED_BUG_EMAIL_DISABLED === 'true';
export const BED_BUG_EMAIL_DISABLED_MESSAGE =
  'Bed Bug agreement email is temporarily disabled. Set BED_BUG_EMAIL_DISABLED=false to enable sending.';
