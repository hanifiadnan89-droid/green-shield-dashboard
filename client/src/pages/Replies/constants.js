export const ARCHIVE_KEY = 'gs_archived_replies';
export const HISTORY_KEY = 'gs_chat_msgs';

export const TMPL_LABEL = {
  na: 'No-Answer follow-up sent',
  ag: 'Agreement follow-up sent',
  ch: 'Check-in sent',
};

export const TMPL_COLOR = {
  na: '#16A34A',
  ag: '#2563EB',
  ch: '#D97706',
};

export const QUICK_REPLIES = [
  { label: 'Confirm', text: "Sounds great! When would work best for you? We can usually get you scheduled within a few days." },
  { label: 'Schedule', text: "I'd love to get you set up! Do you prefer mornings or afternoons?" },
  { label: 'Agreement', text: "Perfect! I'll send over the service agreement for you to review shortly." },
  { label: 'Follow up', text: "Just checking in — are you still interested in getting started? Happy to answer any questions!" },
  { label: 'Call me', text: "Happy to chat! Feel free to give us a call anytime. What's your best time to talk?" },
];
