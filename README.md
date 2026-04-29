# Role Planner — Desktop App

A Windows desktop app for planning your work roles and responsibilities, with full Microsoft 365 integration (Teams Calendar + OneNote) and Windows desktop notifications.

---

## Features

| Module | What it does |
|---|---|
| **Roles & Tasks** | Create roles, add tasks with due dates, track completion |
| **Teams Calendar** | View, create, and delete calendar events linked to roles |
| **OneNote** | Browse notebooks, create pages, attach pages to roles, sync notes |
| **Reminders** | 4 types: scheduled (daily), pre-meeting, overdue tasks, manual snooze |
| **Settings** | Azure credentials, sync config, data export/import |

---

## Quick Start

### 1. Install Node.js

Download from https://nodejs.org — install the **LTS** version (18+).

### 2. Install dependencies

```bash
cd role-planner
npm install
```

### 3. Set up Microsoft Azure (first time only)

See the **Azure Setup** section below, then enter your credentials in **Settings** inside the app.

### 4. Run the app

```bash
npm start
```

### 5. Build an installer (Windows .exe)

```bash
npm run build:win
```

The installer will be in the `dist/` folder.

---

## Azure App Registration Setup

You need a free Microsoft Azure account (the same one as your Microsoft 365 / work account).

### Step-by-step

1. Go to **https://portal.azure.com**

2. Search for **"App registrations"** in the top bar → click **New Registration**

3. Fill in:
   - **Name**: `Role Planner`
   - **Supported account types**: 
     - _Single tenant_ if this is just for you on your work account
     - _Accounts in any organizational directory_ if you want it to work across tenants
   - **Redirect URI**: Select **Public client/native (mobile & desktop)** and enter:
     ```
     http://localhost:3737/auth/callback
     ```

4. Click **Register**

5. On the app overview page, copy:
   - **Application (client) ID** → paste into Settings → Client ID
   - **Directory (tenant) ID** → paste into Settings → Tenant ID

6. Go to **API Permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   
   Add these permissions:
   - `User.Read`
   - `Calendars.ReadWrite`
   - `Notes.ReadWrite.All`
   - `Notes.Create`
   - `offline_access`

7. Click **Grant admin consent** (if you have admin rights) OR sign in and consent on first use

8. Go to **Authentication** (left sidebar):
   - Scroll to **Advanced settings**
   - Set **Allow public client flows** → **Yes**
   - Click **Save**

### If you don't have an Azure account

1. Go to https://azure.microsoft.com/free and sign up (free)
2. If your organisation uses Microsoft 365, ask your IT admin to register the app — they can grant the permissions in step 6

---

## OneNote Sync Setup

Role Planner uses OneNote as the **source of truth** for role data, which means:
- A future mobile app reading OneNote will see the same data
- You can access your notes from any device

**To set up sync:**

1. Open the app → go to **OneNote** tab
2. Browse your notebooks → pick a section (e.g. "Work Notes" → "Role Planner")
3. Copy the section ID from the URL bar in the OneNote web view, OR
4. Go to **Settings** → paste the Section ID

After this, the "Sync to OneNote" button on each role will push notes and tasks to a dedicated OneNote page.

---

## Reminders / Notifications

Four types of Windows desktop notifications:

| Type | How it works |
|---|---|
| **Scheduled** | Fires daily at a set time (e.g. 9:00am). Great for a morning task review. |
| **Pre-meeting** | Fires X minutes before any calendar event. Default: 15 min. |
| **Overdue** | Fires once per day for each task that has passed its due date. |
| **Manual snooze** | Fire a notification in X minutes from now — like a one-off alarm. |

Go to the **Reminders** tab to add, enable/disable, or test notifications.

> **Note**: On first run, Windows may ask to allow notifications from this app. Click Allow.

---

## Project Structure

```
role-planner/
├── src/
│   ├── main.js              # Electron main process, IPC, tray
│   ├── preload.js           # Secure bridge (contextBridge)
│   ├── modules/
│   │   ├── auth.js          # Microsoft OAuth (PKCE)
│   │   ├── calendar.js      # Graph API — Calendar
│   │   ├── onenote.js       # Graph API — OneNote
│   │   ├── notifications.js # Windows notification scheduler
│   │   └── store.js         # Local data + sync helpers
│   └── renderer/
│       ├── index.html       # App shell
│       ├── styles/
│       │   └── main.css     # All styles
│       ├── js/
│       │   ├── app.js       # Router, auth UI, nav
│       │   └── toast.js     # Toast notifications
│       └── pages/
│           ├── roles.js         # Roles & tasks page
│           ├── calendar.js      # Calendar page
│           ├── onenote.js       # OneNote page
│           ├── notifications.js # Reminders page
│           └── settings.js      # Settings page
├── package.json
└── README.md
```

Each module in `src/modules/` is fully independent — you can swap out or extend any of them without touching the others.

---

## Adding a module

1. Create `src/modules/yourmodule.js` with exported functions
2. Import and wire up IPC handlers in `src/main.js`
3. Expose the API in `src/preload.js`
4. Create `src/renderer/pages/yourpage.js` with a `render_yourpage(container)` function
5. Add a nav link in `src/renderer/index.html`

---

## Troubleshooting

**"No Azure App credentials configured"**
→ Go to Settings and enter your Client ID and Tenant ID first.

**Sign-in window doesn't open**
→ Make sure `http://localhost:3737/auth/callback` is registered in Azure as a Public client redirect URI.

**Calendar shows empty**
→ Check that `Calendars.ReadWrite` is granted in Azure API Permissions.

**OneNote shows error**
→ Check that `Notes.ReadWrite.All` is granted. You may need admin consent at your organisation.

**Notifications not appearing**
→ Check Windows Settings → Notifications → Role Planner → ensure it's allowed.

---

## Future: iPhone App

The app is built so Microsoft is the source of truth. When you're ready for a mobile companion:
- A React Native or PWA mobile app connecting to the same Microsoft account will read the same OneNote data
- Calendar events are already synced via Microsoft 365 across all devices
- No separate backend server needed
