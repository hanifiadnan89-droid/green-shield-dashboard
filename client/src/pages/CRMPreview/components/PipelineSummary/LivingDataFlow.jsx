import { memo } from 'react';
import { Activity } from 'lucide-react';
import ReactiveOrb from './ReactiveOrb.jsx';

const LivingDataFlow = memo(function LivingDataFlow({ stats }) {
  return (
    <section className="ps-panel ps-panel--center">
      <div className="ps-panel__head">
        <Activity size={14} />
        <span>Living Data Flow</span>
      </div>
      <div className="ps-center-stage">
        <ReactiveOrb stats={stats} />
      </div>
    </section>
  );
});

export default LivingDataFlow;
