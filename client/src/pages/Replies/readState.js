import { getLatestInbound, inboundReadKey } from './threadUtils.js';

export function parseTimeMs(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function getReadStateForRow(readStateByRow, rowNumber) {
  const entry = readStateByRow?.[rowNumber];
  if (!entry || typeof entry !== 'object') {
    return { lastReadAt: null, lastReadInboundKey: null, readInboundKeys: [] };
  }
  return {
    lastReadAt: entry.lastReadAt ?? null,
    lastReadInboundKey: entry.lastReadInboundKey ?? null,
    readInboundKeys: Array.isArray(entry.readInboundKeys) ? entry.readInboundKeys : [],
  };
}

/**
 * Shared unread rule for Replies + Leads:
 * unread when last inbound is newer than last read (timestamp or inbound key fallback).
 */
export function isInboundNewerThanRead(messages, metaForRow, readStateByRow, rowNumber) {
  const inboundAt = metaForRow?.lastInboundAt || getLatestInbound(messages)?.ts;
  if (!inboundAt) return false;

  const latestInbound = getLatestInbound(messages);
  const latestKey = inboundReadKey(latestInbound);
  if (!latestKey) return false;

  if (metaForRow?.unread === false) return false;

  const localRead = getReadStateForRow(readStateByRow, rowNumber);
  const readInboundKeys = [
    ...(metaForRow?.readInboundKeys || []),
    ...localRead.readInboundKeys,
  ];
  if (readInboundKeys.includes(latestKey)) return false;

  const readAt = metaForRow?.lastReadAt ?? localRead.lastReadAt;
  const readKey = metaForRow?.lastReadInboundKey ?? localRead.lastReadInboundKey;

  const inboundMs = parseTimeMs(inboundAt);
  const readMs = parseTimeMs(readAt);

  if (readMs != null && inboundMs != null) {
    return inboundMs > readMs;
  }

  if (!readKey) return true;
  return readKey !== latestKey;
}
