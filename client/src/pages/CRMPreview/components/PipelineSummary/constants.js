import {
  AlertCircle,
  MessageCircle,
  Send,
  Users,
  Star,
  Shield,
  PhoneOff,
} from 'lucide-react';

export const RING_DEFS = [
  { key: 'reply',      label: 'Reply Rate',  color: '#16A34A', rateKey: 'reply',      Icon: MessageCircle },
  { key: 'noAnswer',   label: 'No Answer',   color: '#2563EB', rateKey: 'noAnswer',  Icon: PhoneOff },
  { key: 'agreements', label: 'Agreements',  color: '#D97706', rateKey: 'agreements', Icon: Shield },
];

export const METRIC_DEFS = [
  { key: 'total',   label: 'Total',   valueKey: 'total',    Icon: Users,          color: '#16A34A' },
  { key: 'sent',    label: 'Sent',    valueKey: 'sentToday', Icon: Send,           color: '#2563EB' },
  { key: 'replies', label: 'Replies', valueKey: 'replied',  Icon: MessageCircle,  color: '#16A34A', rateKey: 'reply' },
  { key: 'errors',  label: 'Errors',  valueKey: 'errors',   Icon: AlertCircle,    color: '#DC2626' },
  { key: 'sold',    label: 'Sold',    valueKey: 'sold',     Icon: Star,           color: '#9333EA', rateKey: 'sold' },
];
