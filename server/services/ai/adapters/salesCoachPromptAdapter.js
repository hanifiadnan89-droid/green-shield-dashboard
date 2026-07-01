function normalizeRowNumber(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function findSalesCoachRowNumber(params = {}) {
  const candidates = [
    params.rowNumber,
    params.row_number,
    params.leadRowNumber,
    params.leadContext?.rowNumber,
    params.leadContext?.row_number,
    params.propertyContext?.rowNumber,
    params.propertyContext?.row_number,
  ];

  for (const candidate of candidates) {
    const rowNumber = normalizeRowNumber(candidate);
    if (rowNumber) return rowNumber;
  }
  return null;
}

export function buildSalesCoachContextOptions(params = {}) {
  const rowNumber = findSalesCoachRowNumber(params);
  if (!rowNumber) return { type: 'sales' };
  return {
    sections: ['sales', 'lead', 'conversation'],
    rowNumber,
  };
}

function extractLead(aiSalesContext = {}) {
  return aiSalesContext.lead?.lead || null;
}

function extractConversation(aiSalesContext = {}) {
  return aiSalesContext.conversation || null;
}

function latestCustomerMessage(conversationContext = null) {
  return conversationContext?.latestCustomerMessage?.body
    || conversationContext?.conversation?.latestCustomerMessage?.body
    || null;
}

export function buildSalesCoachPromptInput(aiSalesContext, params = {}) {
  const lead = extractLead(aiSalesContext);
  const conversation = extractConversation(aiSalesContext);
  const propertyContext = { ...(params.propertyContext || {}) };
  const leadContext = { ...(params.leadContext || {}) };

  if (lead) {
    propertyContext.customerName = lead.name || propertyContext.customerName;
    propertyContext.address = lead.address || propertyContext.address;
    propertyContext.propertyType = lead.propertyType || lead.property_type || propertyContext.propertyType;

    leadContext.pricing = lead.pricing || leadContext.pricing;
    leadContext.notes = lead.notes || leadContext.notes;
    leadContext.leadNotes = lead.notes || leadContext.leadNotes;
    leadContext.previousMessage = latestCustomerMessage(conversation) || leadContext.previousMessage;
    leadContext.bestContactMethod = lead.bestContactMethod || leadContext.bestContactMethod;
    leadContext.status = lead.displayStatus || lead.computedStatus || lead.status || leadContext.status;
  }

  return {
    situation: params.situation || params.repQuestion || '',
    category: params.category ?? null,
    service: params.service ?? null,
    personality: params.personality ?? null,
    propertyContext,
    leadContext,
    sessionId: params.sessionId || null,
    aiContext: aiSalesContext || null,
  };
}

export default {
  buildSalesCoachContextOptions,
  buildSalesCoachPromptInput,
};
