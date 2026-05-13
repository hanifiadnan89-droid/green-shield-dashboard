# Green Shield Control Center — Setup Guide

## What This Is
A private web dashboard that runs on your laptop.
Open http://localhost:5173 to use it.
No internet hosting needed — it's all local.

---

## Step 1: Create a Google Service Account (one-time, ~5 minutes)

This lets the dashboard read and write your Lead Responses Google Sheet.

1. Go to https://console.cloud.google.com
2. Create a new project (name it "Green Shield Dashboard" or anything)
3. Go to **APIs & Services → Library**
4. Search and enable: **Google Sheets API** and **Google Drive API**
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → Service Account**
7. Name it "green-shield-dashboard" → Create
8. After creation, click the service account email → **Keys tab** → **Add Key → JSON**
9. This downloads a .json file — keep it safe

**Copy the JSON contents into your .env:**

Option A — Paste JSON inline in .env:
```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...entire file on one line...}
```

Option B — Point to the file in .env:
```
GOOGLE_SERVICE_ACCOUNT_FILE=/Users/adnanhanifi/green-shield-sa-key.json
```

10. **Share your Google Sheet with the service account email**
    - Open https://docs.google.com/spreadsheets/d/1hneyXzxNqHDM-AfNs5-c1Qp7jqBeHfpKKsYbf_62obk
    - Click Share → Paste the service account email (looks like name@project.iam.gserviceaccount.com)
    - Give it **Editor** access

---

## Step 2: Edit Your .env File

Open this file: `green-shield-dashboard/server/.env`

Fill in:
- `GOOGLE_SERVICE_ACCOUNT_JSON=` or `GOOGLE_SERVICE_ACCOUNT_FILE=`
- Everything else is already pre-filled with your real values

When ready to go live (send real messages):
- Change `TEST_MODE=true` to `TEST_MODE=false`

---

## Step 3: Add Quote Files (optional, do later)

1. Upload your quote PDFs to Google Drive
2. Open each file, copy the file ID from the URL:
   `https://drive.google.com/file/d/THIS_IS_THE_ID/view`
3. Add to .env:
   ```
   QUOTE_NORMAL_DRIVE_ID=paste_id_here
   QUOTE_DISCOUNTED_DRIVE_ID=paste_id_here
   ```
4. Share each file with your service account email (or make it "anyone with link")

---

## Step 4: Start the Dashboard

Open Terminal and run:
```
cd ~/green-shield-dashboard
bash start.sh
```

Then open your browser to: **http://localhost:5173**

Or start manually:
```
cd ~/green-shield-dashboard
npm run dev
```

To stop: press **Ctrl+C** in the terminal.

---

## How to Use

### Dashboard
- Summary cards: total leads, sent today, replies, errors
- Recent activity feed
- Quick links to Send and Manage Leads

### Leads Page
- Full table of all leads from your Google Sheet
- Search across any field
- Filter by status, notes, stop, replies
- Click the Send icon (→) to trigger a template for a lead
- Click the Stop icon to stop follow-ups for a lead
- Click the Edit icon to update name, notes, status, etc.

### Send Template
3-step flow:
1. Pick a lead (search by name, phone, email)
2. Choose a template:
   - **AG** — Agreement Sent follow-up sequence
   - **NA** — No Answer outreach sequence
   - **RIT** — Rodent/Insect Triannual proposal
   - **T/M** — Tick & Mosquito proposal
   - **IQ** — Insect Quarterly proposal
3. Preview + choose channel (SMS+Email, SMS only, Email only) → Send

n8n handles the actual sending and the 2-day + 5-day follow-up sequence automatically.

### Workflows
Shows your 4 active n8n workflows with status and links to open them directly.

### Follow-ups
Shows leads that were sent a template but haven't replied and aren't stopped.
Color-coded by how long ago they were sent:
- Green = recent
- Yellow = 3+ days
- Red = 7+ days (needs attention)

### Activity Log
Full audit trail of every action taken in the dashboard.
Shows TEST or LIVE mode per action, timestamp, lead name, template used, errors.

---

## Test Mode vs Live Mode

**TEST MODE (safe — default)**
- The dashboard shows what WOULD happen
- No real emails or SMS are sent
- The Google Sheet is NOT updated
- Activities are logged with [TEST] tag
- Banner at the top says TEST MODE in yellow

**LIVE MODE (real sends)**
- Set `TEST_MODE=false` in `server/.env`
- Restart the server
- Red banner at top says LIVE MODE
- Actions are real — use carefully

---

## Folder Structure

```
green-shield-dashboard/
├── server/             ← Node.js API (port 3001)
│   ├── .env            ← Your credentials (never share this)
│   ├── index.js
│   ├── routes/         ← leads, send, workflows, activity, drive
│   ├── services/       ← sheets.js, n8n.js, activity.js
│   └── data/
│       └── activity.json  ← Local activity log (auto-created)
├── client/             ← React dashboard (port 5173)
│   └── src/
│       ├── pages/      ← Dashboard, Leads, SendTemplate, etc.
│       └── components/
├── .env.example        ← Template for credentials
├── start.sh            ← One-click start script
└── SETUP.md            ← This file
```

---

## Troubleshooting

**"Google credentials not configured" banner**
→ Add GOOGLE_SERVICE_ACCOUNT_JSON to server/.env and restart

**Leads won't load**
→ Check that you shared the Lead Responses sheet with the service account email

**n8n webhook fails**
→ Make sure your n8n instance is running at https://leadsales.app.n8n.cloud
→ Check that the Lead Email Responder workflow is active

**Port already in use**
→ Run: `lsof -ti :3001 | xargs kill && lsof -ti :5173 | xargs kill`
→ Then run `bash start.sh` again

**Test mode won't turn off**
→ Edit `server/.env`, change `TEST_MODE=true` to `TEST_MODE=false`, then restart

---

## Your Pre-Configured Values

| Setting | Value |
|---------|-------|
| Lead Responses Sheet ID | `1hneyXzxNqHDM-AfNs5-c1Qp7jqBeHfpKKsYbf_62obk` |
| n8n base URL | `https://leadsales.app.n8n.cloud` |
| Lead webhook path | `/webhook/lead-response` |
| SMS responder webhook | `/webhook/85f92afd-4902-4083-b932-fa694217611e` |
