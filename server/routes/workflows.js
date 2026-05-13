import express from 'express';
import { WORKFLOW_CATALOG, getWorkflowStatuses } from '../services/n8n.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const statuses = await getWorkflowStatuses();
  const workflows = WORKFLOW_CATALOG.map(wf => {
    if (statuses) {
      const live = statuses.find(s => s.id === wf.id);
      if (live) return { ...wf, active: live.active };
    }
    return wf;
  });
  res.json({ workflows });
});

export default router;
