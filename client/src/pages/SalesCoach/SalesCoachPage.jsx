import { useState, lazy, Suspense } from 'react';
import { Brain, MessageSquare, Target, PhoneCall, BarChart2, Clock3, BookOpen, TrendingUp } from 'lucide-react';
import './SalesCoach.css';

const ObjectionCoach = lazy(() => import('./modules/ObjectionCoach.jsx'));

const MODULES = [
  {
    id: 'objection-coach',
    icon: MessageSquare,
    iconBg: 'linear-gradient(135deg, #16a34a, #15803d)',
    iconColor: '#fff',
    title: 'Handle an Objection',
    desc: 'Get a real-time, personalized response to any customer objection — tailored to the lead, service, and situation.',
    active: true,
  },
  {
    id: 'pricing-coach',
    icon: Target,
    iconBg: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    iconColor: '#fff',
    title: 'Pricing Coach',
    desc: 'Build confidence around price. Get scripts for anchoring, bundling, and closing on value — not cost.',
    active: false,
  },
  {
    id: 'call-strategy',
    icon: PhoneCall,
    iconBg: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    iconColor: '#fff',
    title: 'Call Strategy',
    desc: 'Plan your next call with a structured approach: what to say first, how to qualify fast, when to close.',
    active: false,
  },
  {
    id: 'pattern-analysis',
    icon: BarChart2,
    iconBg: 'linear-gradient(135deg, #0891b2, #0e7490)',
    iconColor: '#fff',
    title: 'Objection Patterns',
    desc: 'See which objections come up most and which responses actually close deals — learned from your team.',
    active: false,
  },
  {
    id: 'best-time',
    icon: Clock3,
    iconBg: 'linear-gradient(135deg, #d97706, #b45309)',
    iconColor: '#fff',
    title: 'Best Time to Call',
    desc: 'AI-driven call timing recommendations based on lead behavior, day of week, and historical close rates.',
    active: false,
  },
  {
    id: 'scripts',
    icon: BookOpen,
    iconBg: 'linear-gradient(135deg, #0f766e, #0d9488)',
    iconColor: '#fff',
    title: 'Scripts Library',
    desc: 'Browse battle-tested scripts for every stage of the sales cycle — from door approach to final close.',
    active: false,
  },
  {
    id: 'performance',
    icon: TrendingUp,
    iconBg: 'linear-gradient(135deg, #be185d, #9d174d)',
    iconColor: '#fff',
    title: 'Performance Insights',
    desc: 'Track your coaching usage, win rates by objection type, and improvement over time.',
    active: false,
  },
];

export default function SalesCoachPage() {
  const [activeModule, setActiveModule] = useState(null);

  if (activeModule === 'objection-coach') {
    return (
      <div className="sc-root">
        <header className="sc-header">
          <div className="sc-header__identity">
            <div className="sc-header__icon">
              <Brain size={18} />
            </div>
            <div>
              <div className="sc-header__title">Sales Coach</div>
              <div className="sc-header__subtitle">Green Shield AI Sales Brain</div>
            </div>
          </div>
          <div className="sc-header__module-name">
            <button
              className="sc-header__back"
              onClick={() => setActiveModule(null)}
            >
              ← All Modules
            </button>
            <h1>Handle an Objection</h1>
          </div>
        </header>
        <div className="sc-body">
          <Suspense fallback={<div className="text-sm text-gs-muted p-4">Loading…</div>}>
            <ObjectionCoach />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-root">
      <header className="sc-header">
        <div className="sc-header__identity">
          <div className="sc-header__icon">
            <Brain size={18} />
          </div>
          <div>
            <div className="sc-header__title">Sales Coach</div>
            <div className="sc-header__subtitle">Green Shield AI Sales Brain</div>
          </div>
        </div>
      </header>

      <div className="sc-body">
        <div className="sc-home-kicker">Training Modules</div>
        <div className="sc-module-grid">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className={`sc-module-card ${mod.active ? 'sc-module-card--active' : 'sc-module-card--soon'}`}
                onClick={mod.active ? () => setActiveModule(mod.id) : undefined}
              >
                <div
                  className="sc-module-card__icon-wrap"
                  style={{ background: mod.iconBg }}
                >
                  <Icon size={20} color={mod.iconColor} />
                </div>
                <div className="sc-module-card__title">{mod.title}</div>
                <div className="sc-module-card__desc">{mod.desc}</div>
                <span className={`sc-module-card__badge ${mod.active ? 'sc-module-card__badge--active' : 'sc-module-card__badge--soon'}`}>
                  {mod.active ? 'Available' : 'Coming Soon'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
