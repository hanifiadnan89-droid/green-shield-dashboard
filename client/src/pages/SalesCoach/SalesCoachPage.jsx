import { useState, lazy, Suspense } from 'react';
import { GraduationCap } from 'lucide-react';
import { SalesCoachHeader }         from './components/SalesCoachHeader.jsx';
import './SalesCoach.css';

const ObjectionCoach  = lazy(() => import('./modules/ObjectionCoach/ObjectionCoach.jsx'));
const TrainingCenter  = lazy(() => import('./modules/TrainingCenter/TrainingCenter.jsx'));

export default function SalesCoachPage() {
  const [activeView,      setActiveView]      = useState('coach');
  const [moduleConfidence, setModuleConfidence] = useState(null);

  const handleBack = () => {
    setActiveView('coach');
    setModuleConfidence(null);
  };

  if (activeView === 'training') {
    return (
      <div className="sc-root">
        <SalesCoachHeader moduleName="Training Center" onBack={handleBack} />
        <div className="sc-module-fill">
          <Suspense fallback={<div className="text-sm text-gs-muted p-4">Loading…</div>}>
            <TrainingCenter />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-root">
      <SalesCoachHeader
        confidence={moduleConfidence}
        action={(
          <button
            type="button"
            className="sc-training-link"
            onClick={() => setActiveView('training')}
          >
            <GraduationCap size={15} />
            Training Center
          </button>
        )}
      />
      <div className="sc-module-fill">
        <Suspense fallback={<div className="text-sm text-gs-muted p-4">Loading…</div>}>
          <ObjectionCoach
            onConfidenceUpdate={setModuleConfidence}
          />
        </Suspense>
      </div>
    </div>
  );
}
