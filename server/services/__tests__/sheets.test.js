import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMock: vi.fn(),
  updateMock: vi.fn(),
  appendMock: vi.fn(),
  googleSheetsMock: vi.fn(() => ({
    spreadsheets: {
      values: {
        get: vi.fn(),
        update: vi.fn(),
        append: vi.fn(),
      },
    },
  })),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn(() => ({})),
    },
    sheets: mocks.googleSheetsMock,
  },
}));

vi.mock('../googleCredentials.js', () => ({
  loadGoogleCredentials: vi.fn(() => ({
    client_email: 'svc@example.com',
    private_key: 'PRIVATE_KEY',
  })),
}));

import {
  appendLead,
  getLeads,
  updateLead,
  writeRepliesLastReadAt,
} from '../sheets.js';

function buildLeadRows() {
  const header = Array(15).fill('header');
  const lead = Array(15).fill('');
  lead[0] = 'Alice';
  lead[2] = 'alice@example.com';
  lead[4] = 'active';
  lead[8] = '+15551234567';
  return [header, lead];
}

describe('sheets service config resolution', () => {
  let originalEnv;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-sheets-'));
    originalEnv = {
      TEST_MODE: process.env.TEST_MODE,
      SHEET_ID: process.env.SHEET_ID,
      SHEET_NAME: process.env.SHEET_NAME,
      LEAD_OWNERSHIP_FILE: process.env.LEAD_OWNERSHIP_FILE,
    };
    process.env.TEST_MODE = 'false';
    process.env.SHEET_ID = 'env-sheet';
    process.env.SHEET_NAME = 'Lead Responses';
    process.env.LEAD_OWNERSHIP_FILE = path.join(tmpDir, 'lead-ownership.json');
    mocks.getMock.mockReset();
    mocks.updateMock.mockReset();
    mocks.appendMock.mockReset();
    mocks.googleSheetsMock.mockClear();
    mocks.googleSheetsMock.mockImplementation(() => ({
      spreadsheets: {
        values: {
          get: mocks.getMock,
          update: mocks.updateMock,
          append: mocks.appendMock,
        },
      },
    }));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('uses the integration profile sheet ID and tab name when present', async () => {
    mocks.getMock.mockResolvedValueOnce({ data: { values: buildLeadRows() } });

    const context = {
      userId: 'user_ah',
      integrationProfile: {
        google: {
          masterLeadSheetId: 'profile-master',
          leadResponsesSheetId: 'profile-leads',
          customerDatabaseSheetId: 'profile-customers',
        },
        gmail: { senderEmail: 'ah@example.com' },
        twilio: { phoneNumber: '+15551234567', messagingServiceSid: 'MG123' },
      },
    };

    const leads = await getLeads(context);
    expect(leads).toHaveLength(1);
    expect(mocks.getMock).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'profile-leads',
      range: 'Lead Responses!A:O',
    }));
  });

  it('falls back to env sheet config when no profile is available', async () => {
    mocks.getMock.mockResolvedValueOnce({ data: { values: buildLeadRows() } });

    const leads = await getLeads({});
    expect(leads).toHaveLength(1);
    expect(mocks.getMock).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'env-sheet',
      range: 'Lead Responses!A:O',
    }));
  });

  it('passes the resolved sheet ID through update and append operations', async () => {
    mocks.getMock.mockResolvedValueOnce({ data: { values: [Array(15).fill('existing')] } });

    const context = {
      userId: 'user_ah',
      integrationProfile: {
        google: {
          masterLeadSheetId: 'profile-master',
          leadResponsesSheetId: 'profile-leads',
          customerDatabaseSheetId: 'profile-customers',
        },
      },
    };

    await updateLead(7, { status: 'replied', notes: 'Updated' }, context);
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'profile-leads',
      range: 'Lead Responses!A7:O7',
      valueInputOption: 'RAW',
    }));

    await appendLead({ name: 'Jamie', email: 'jamie@example.com' }, context);
    expect(mocks.appendMock).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'profile-leads',
      range: 'Lead Responses!A:O',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
    }));
  });

  it('writes replies_last_read_at using the resolved sheet config', async () => {
    await writeRepliesLastReadAt(12, '2026-06-28T12:00:00.000Z', {
      userId: 'user_ah',
      integrationProfile: {
        google: {
          leadResponsesSheetId: 'profile-leads',
        },
      },
    });

    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'profile-leads',
      range: 'Lead Responses!O12',
      valueInputOption: 'RAW',
    }));
  });
});
