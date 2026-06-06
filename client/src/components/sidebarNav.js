import {
  LayoutDashboard, Users, Send, Clock, Activity,
  MessageSquare, Navigation,
} from 'lucide-react';

/** Shared sidebar structure — WORKSPACE / TOOLS on every page */
export const SIDEBAR_NAV = [
  {
    group: 'WORKSPACE',
    items: [
      { type: 'home', icon: LayoutDashboard, label: 'Dashboard' },
      { type: 'link', to: '/leads', icon: Users, label: 'All Leads' },
      { type: 'link', to: '/followups', icon: Clock, label: 'Follow-ups' },
      { type: 'link', to: '/activity', icon: Activity, label: 'Activity Log' },
    ],
  },
  {
    group: 'TOOLS',
    items: [
      { type: 'link', to: '/tools/route-finder', icon: Navigation, label: 'Route Finder' },
      { type: 'link', to: '/send', icon: Send, label: 'Send Template' },
      { type: 'link', to: '/replies', icon: MessageSquare, label: 'Replies', badge: 'replied' },
    ],
  },
];
