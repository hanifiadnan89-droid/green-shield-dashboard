import {
  LayoutDashboard, Users, Send, Clock, Activity,
  MessageSquare, Navigation, ClipboardList, Brain, ShieldAlert, Shield,
  Sparkles,
} from 'lucide-react';

/** Shared sidebar structure — OPERATIONS / WORKSPACE */
export const SIDEBAR_NAV = [
  {
    group: 'OPERATIONS',
    items: [
      { type: 'link', to: '/intake', icon: ClipboardList, label: 'Intake', feature: 'intake' },
      { type: 'link', to: '/send', icon: Send, label: 'Send Template' },
      { type: 'link', to: '/sales-coach', icon: Brain, label: 'Sales Coach' },
      { type: 'link', to: '/tools/route-finder', icon: Navigation, label: 'Route Finder' },
      { type: 'link', to: '/replies', icon: MessageSquare, label: 'Replies', badge: 'replied' },
    ],
  },
  {
    group: 'WORKSPACE',
    items: [
      { type: 'home', icon: LayoutDashboard, label: 'Dashboard' },
      { type: 'link', to: '/leads', icon: Users, label: 'All Leads' },
      { type: 'link', to: '/followups', icon: Clock, label: 'Follow-ups' },
      { type: 'link', to: '/activity', icon: Activity, label: 'Activity Log' },
      { type: 'link', to: '/errors', icon: ShieldAlert, label: 'Error Center' },
    ],
  },
  {
    group: 'ADMIN',
    items: [
      { type: 'link', to: '/admin/users', icon: Shield, label: 'Users', adminOnly: true },
      { type: 'link', to: '/admin/ai-observability', icon: Sparkles, label: 'AI Observability', adminOnly: true },
    ],
  },
];
