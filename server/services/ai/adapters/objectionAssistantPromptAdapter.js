function normalizeRowNumber(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function findRowNumber(params = {}) {
  const candidates = [
    params.rowNumber,
    params.row_number,
    params.leadRowNumber,
    params.context?.rowNumber,
    params.context?.row_number,
    params.context?.leadRowNumber,
  ];

  for (const candidate of candidates) {
    const rowNumber = normalizeRowNumber(candidate);
    if (rowNumber) return rowNumber;
  }
  return null;
}

export function buildObjectionAssistantContextOptions(params = {}) {
  const rowNumber = findRowNumber(params);
  if (!rowNumber) return { type: 'sales' };
  return {
    sections: ['sales', 'lead', 'conversation'],
    rowNumber,
  };
}

function extractLead(aiContext = {}) {
  return aiContext.lead?.lead || null;
}

function extractLatestCustomerMessage(aiContext = {}) {
  return aiContext.conversation?.latestCustomerMessage?.body
    || aiContext.conversation?.conversation?.latestCustomerMessage?.body
    || null;
}

export function buildObjectionAssistantPromptInput(aiContext, params = {}) {
  const lead = extractLead(aiContext);
  const context = { ...(params.context || {}) };

  if (lead) {
    context.customerName = lead.name || context.customerName;
    context.address = lead.address || context.address;
    context.propertyType = lead.propertyType || lead.property_type || context.propertyType;
    context.serviceType = lead.serviceType || lead.service_type || lead.service || context.serviceType;
    context.previousMessage = extractLatestCustomerMessage(aiContext) || context.previousMessage;
  }

  return {
    context,
    objection: params.objection || '',
    action: params.action || null,
    existing_response: params.existing_response || '',
  };
}

export default {
  buildObjectionAssistantContextOptions,
  buildObjectionAssistantPromptInput,
};
