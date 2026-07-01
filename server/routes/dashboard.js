import express from 'express';
import { getCurrentUserContext } from '../services/currentUserContext.js';
import { getDashboardData } from '../services/crmData/dashboardQueries.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (!context) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (context.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }

    const dashboard = await getDashboardData(context);
    return res.json(dashboard);
  } catch (err) {
    const status = err?.status || err?.statusCode || 500;
    return res.status(status).json({
      error: err?.message || 'Failed to load dashboard',
      code: err?.code || 'DASHBOARD_LOAD_FAILED',
    });
  }
});

export default router;
