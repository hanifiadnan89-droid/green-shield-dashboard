const SESSION_KEY = 'gs-intake-session';

export function createEmptyIntakeSession() {
  return {
    version: 1,
    customer: null,
    property: null,
    updatedAt: null,
  };
}

export function loadIntakeSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return createEmptyIntakeSession();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyIntakeSession();
    return {
      ...createEmptyIntakeSession(),
      ...parsed,
    };
  } catch {
    return createEmptyIntakeSession();
  }
}

export function saveIntakeSession(session) {
  const next = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearIntakeSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function updateIntakeCustomer(customer) {
  const session = loadIntakeSession();
  session.customer = customer;
  return saveIntakeSession(session);
}

export function updateIntakeProperty(property) {
  const session = loadIntakeSession();
  session.property = property;
  return saveIntakeSession(session);
}
