import express from 'express';
import { google } from 'googleapis';
import { loadGoogleCredentials } from '../services/googleCredentials.js';

const router = express.Router();

function getAuth() {
  const credentials = loadGoogleCredentials();
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
}

function driveViewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

router.get('/quotes', async (req, res) => {
  const normalId = process.env.QUOTE_NORMAL_DRIVE_ID;
  const discountedId = process.env.QUOTE_DISCOUNTED_DRIVE_ID;

  const quotes = [
    {
      type: 'normal',
      label: 'Normal Quote',
      description: 'Standard pricing quote',
      driveId: normalId || null,
      url: normalId ? driveViewUrl(normalId) : null,
      configured: !!normalId
    },
    {
      type: 'discounted',
      label: 'Discounted Quote',
      description: 'Discounted pricing quote',
      driveId: discountedId || null,
      url: discountedId ? driveViewUrl(discountedId) : null,
      configured: !!discountedId
    }
  ];

  if (!normalId && !discountedId) {
    return res.json({ quotes, note: 'Add QUOTE_NORMAL_DRIVE_ID and QUOTE_DISCOUNTED_DRIVE_ID to .env to enable quote links' });
  }

  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    for (const quote of quotes) {
      if (!quote.driveId) continue;
      try {
        const meta = await drive.files.get({
          fileId: quote.driveId,
          fields: 'id,name,webViewLink,size,modifiedTime'
        });
        quote.fileName = meta.data.name;
        quote.webViewLink = meta.data.webViewLink;
        quote.url = meta.data.webViewLink || driveViewUrl(quote.driveId);
        quote.modifiedTime = meta.data.modifiedTime;
      } catch {
        quote.error = 'Could not fetch file metadata (check Drive sharing permissions)';
      }
    }
  } catch {
    // Credentials not configured — return static data
  }

  res.json({ quotes });
});

export default router;
