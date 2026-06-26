import { api } from '../../../api/client.js';

export const salesCoachApi = {
  runModule: (module, params, sessionId) =>
    api.salesCoach.runModule({ module, sessionId, ...params }),

  saveFeedback: (body) => api.ai.objectionFeedback(body),
  saveOutcome:  (body) => api.ai.objectionOutcome(body),

  sessions: {
    list: (params) => api.salesCoach.sessions(params),
  },

  training: {
    list:   (type)      => api.salesCoach.training.list(type),
    create: (body)      => api.salesCoach.training.create(body),
    update: (id, body)  => api.salesCoach.training.update(id, body),
    delete: (id)        => api.salesCoach.training.delete(id),
  },
};
