import {
  LayoutDashboard, Users, Send, Workflow, Clock, Activity,
  MessageSquare, AlertCircle, StopCircle, Navigation,
} from 'lucide-react';

/** Shared sidebar structure — WORKSPACE / FILTERS / TOOLS on every page */
export const SIDEBAR_NAV = [
  {
    group: 'WORKSPACE',
    items: [
      { type: 'home', icon: LayoutDashboard, label: 'Dashboard' },
      { type: 'link', to: '/leads', icon: Users, label: 'All Leads' },
      { type: 'link', to: '/followups', icon: Clock, label: 'Follow-ups' },
      { type: 'link', to: '/replies', icon: MessageSquare, label: 'Replies', badge: 'replied' },
    ],
  },
  {
    group: 'FILTERS',
    items: [
      { type: 'filter', filterKey: 'errors', icon: AlertCircle, label: 'Errors', badge: 'errors', urgent: true },
      { type: 'filter', filterKey: 'stopped', icon: StopCircle, label: 'Stopped', badge: 'stopped' },
      { type: 'filter', filterKey: 'inprogress', icon: Clock, label: 'In Progress', badge: 'inProgress' },
    ],
  },
  {
    group: 'TOOLS',
    items: [
      { type: 'link', to: '/tools/route-finder', icon: Navigation, label: 'Route Finder' },
      { type: 'link', to: '/send', icon: Send, label: 'Send Template' },
      { type: 'link', to: '/workflows', icon: Workflow, label: 'Workflows' },
      { type: 'link', to: '/activity', icon: Activity, label: 'Activity Log' },
    ],
  },
];
