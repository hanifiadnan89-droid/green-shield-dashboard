import express from 'express';
import {
  createUser,
  deactivateUser,
  getOrganizationById,
  getUserById,
  listUsers,
  reactivateUser,
  resetUserPassword,
  updateUser,
} from '../services/organizationUsers.js';
import { getCurrentUserContext } from '../services/currentUserContext.js';
import { hasCapability, requireActiveUser } from '../security/internalAccess.js';

const router = express.Router();

router.use(requireActiveUser);

function requireUsersCapability(capability) {
  return (req, res, next) => {
    const context = getCurrentUserContext(req);
    if (!context) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (!hasCapability(context, capability)) {
      return res.status(403).json({ error: 'Admin access required.', code: 'ADMIN_REQUIRED' });
    }
    return next();
  };
}

function withOrganizationContext(req) {
  const context = getCurrentUserContext(req);
  return {
    context,
    organization: context ? getOrganizationById(context.organizationId) : null,
  };
}

router.get('/', requireUsersCapability('view_users'), (req, res) => {
  const { context, organization } = withOrganizationContext(req);
  const users = listUsers({ organizationId: context.organizationId, includeInactive: true });
  res.json({
    organization,
    users,
    count: users.length,
  });
});

router.get('/:userId', requireUsersCapability('view_users'), (req, res) => {
  const context = getCurrentUserContext(req);
  const user = getUserById(req.params.userId);
  if (!user || user.organizationId !== context.organizationId) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
});

router.post('/', requireUsersCapability('manage_users'), (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const user = createUser({
      ...req.body,
      organizationId: context.organizationId,
    }, context.userId);
    return res.status(201).json({ user });
  } catch (err) {
    return res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({
      error: err.message || 'Failed to create user',
      code: err.code || 'CREATE_USER_FAILED',
    });
  }
});

router.put('/:userId', requireUsersCapability('manage_users'), (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const existing = getUserById(req.params.userId);
    if (!existing || existing.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = updateUser(req.params.userId, {
      ...req.body,
      organizationId: context.organizationId,
    }, context.userId);
    return res.json({ user });
  } catch (err) {
    return res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({
      error: err.message || 'Failed to update user',
      code: err.code || 'UPDATE_USER_FAILED',
    });
  }
});

router.post('/:userId/reset-password', requireUsersCapability('manage_users'), (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const existing = getUserById(req.params.userId);
    if (!existing || existing.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = resetUserPassword(req.params.userId, req.body?.password, context.userId);
    return res.json({ user });
  } catch (err) {
    return res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({
      error: err.message || 'Failed to reset user password',
      code: err.code || 'RESET_PASSWORD_FAILED',
    });
  }
});

router.post('/:userId/deactivate', requireUsersCapability('manage_users'), (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const existing = getUserById(req.params.userId);
    if (!existing || existing.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = deactivateUser(req.params.userId, context.userId);
    return res.json({ user });
  } catch (err) {
    return res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({
      error: err.message || 'Failed to deactivate user',
      code: err.code || 'DEACTIVATE_USER_FAILED',
    });
  }
});

router.post('/:userId/reactivate', requireUsersCapability('manage_users'), (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const existing = getUserById(req.params.userId);
    if (!existing || existing.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = reactivateUser(req.params.userId, context.userId);
    return res.json({ user });
  } catch (err) {
    return res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({
      error: err.message || 'Failed to reactivate user',
      code: err.code || 'REACTIVATE_USER_FAILED',
    });
  }
});

export default router;
