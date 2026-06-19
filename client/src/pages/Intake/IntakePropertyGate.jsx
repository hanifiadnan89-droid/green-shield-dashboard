import { Navigate } from 'react-router-dom';
import { isIntakeEnabled } from '../../utils/intake/intakeFeatureFlag.js';
import IntakePropertyErrorBoundary from './components/IntakePropertyErrorBoundary.jsx';
import IntakePropertyPage from './IntakePropertyPage.jsx';

export default function IntakePropertyGate() {
  if (!isIntakeEnabled()) {
    return <Navigate to="/" replace />;
  }

  return (
    <IntakePropertyErrorBoundary>
      <IntakePropertyPage />
    </IntakePropertyErrorBoundary>
  );
}
