import { Navigate } from 'react-router-dom';
import { isIntakeEnabled } from '../../utils/intake/intakeFeatureFlag.js';
import IntakeCustomerPage from './IntakeCustomerPage.jsx';

export default function IntakeGate() {
  if (!isIntakeEnabled()) {
    return <Navigate to="/" replace />;
  }
  return <IntakeCustomerPage />;
}
