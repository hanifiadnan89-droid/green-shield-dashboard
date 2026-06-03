import { getLatestInbound, inboundReadKey } from './threadUtils.js';

export function parseTimeMs(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Shared unread rule for Replies + Leads:
 * unread when last inbound is newer than last read (timestamp or inbound key fallback).
 *
 * @param {Array} messages - server thread messages
 * @param {object} [metaForRow] - sync meta (lastInboundAt, lastReadAt, lastReadInboundKey)
 * @param {Record<string, string>} [readAtByRow] - row -> lastReadAt ISO string
 * @param {number} rowNumber
 */
export function isInboundNewerThanRead(messages, metaForRow, readAtByRow, rowNumber) {
  const inboundAt = metaForRow?.lastInboundAt || getLatestInbound(messages)?.ts;
  if (!inboundAt) return false;

  const inboundMs = parseTimeMs(inboundAt);
  const readAt = metaForRow?.lastReadAt ?? readAtByRow?.[rowNumber];
  const readMs = parseTimeMs(readAt);

  if (readMs != null && inboundMs != null) {
    return inboundMs > readMs;
  }

  const latestInbound = getLatestInbound(messages);
  const latestKey = inboundReadKey(latestInbound);
  if (!latestKey) return false;
  const readKey = metaForRow?.lastReadInboundKey ?? readAtByRow?.[rowNumber];
  if (!readKey) return true;
  return readKey !== latestKey;
}
