import { Navigate } from 'react-router-dom';
import { isIntakeEnabled } from '../../utils/intake/intakeFeatureFlag.js';
import IntakePropertyPage from './IntakePropertyPage.jsx';

export default function IntakePropertyGate() {
  if (!isIntakeEnabled()) {
    return <Navigate to="/" replace />;
  }
  return <IntakePropertyPage />;
}
