export const TEMPLATES = [
  {
    code: 'ag',   label: 'AG — Agreement Sent',         accentText: 'text-gs-accent',  accentDot: 'bg-gs-accent',  activeBg: 'bg-gs-accent/10 border-gs-accent/30',
    description: 'Follow-up sequence for leads who were sent an agreement. Sends reminder email + SMS, with follow-ups at 2 days and 5 days.',
    sequence: ['Initial agreement follow-up (email + SMS)', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 'na',   label: 'NA — No Answer',              accentText: 'text-gs-warn',    accentDot: 'bg-gs-warn',    activeBg: 'bg-gs-warn/10 border-gs-warn/30',
    description: 'Outreach sequence for no-answer leads. Sends initial contact email + SMS, followed up at 2 and 5 days.',
    sequence: ['Initial no-answer outreach (email + SMS)', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 'rit',  label: 'RIT — Rodent/Insect Triannual', accentText: 'text-gs-info',  accentDot: 'bg-gs-info',    activeBg: 'bg-gs-info/10 border-gs-info/30',
    description: 'Rodent & Insect Triannual service proposal. Sends pricing and service details via email + SMS.',
    sequence: ['RIT service email + SMS', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 't/m',  label: 'T/M — Tick & Mosquito',       accentText: 'text-pink-400',   accentDot: 'bg-pink-400',   activeBg: 'bg-pink-500/10 border-pink-500/30',
    description: 'Tick & Mosquito Monthly service proposal. Sends TMM pricing and details via email + SMS.',
    sequence: ['T/M service email + SMS', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 'iq',   label: 'IQ — Insect Quarterly',       accentText: 'text-gs-purple',  accentDot: 'bg-gs-purple',  activeBg: 'bg-gs-purple/10 border-gs-purple/30',
    description: 'Insect Quarterly service proposal. Sends IQ pricing and service details via email + SMS.',
    sequence: ['IQ service email + SMS', '2-day follow-up', '5-day follow-up']
  }
];

export const CHANNELS = [
  { code: 'both',  label: 'SMS + Email', desc: 'Send via both channels (recommended)' },
  { code: 'sms',   label: 'SMS Only',    desc: 'Only send SMS via Twilio'             },
  { code: 'email', label: 'Email Only',  desc: 'Only send Gmail email'                }
];

export const STEPS = [
  { n: 1, label: 'Pick Lead' },
  { n: 2, label: 'Choose Template' },
  { n: 3, label: 'Preview & Send' },
];
