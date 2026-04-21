# Pothole Detection System
### SOFTDESBG6 — Road Infrastructure Monitoring Web Application

A computer vision web application that detects potholes using a trained YOLOv8 model. Supports live webcam, image uploads, and video file analysis. Detections are **not saved automatically** — the user is always asked for a location and given the choice to save or discard. All saved detections go to Supabase with daily priority reports and CSV email alerts per barangay.

---

## Features

- **Image Upload** — Upload a road photo, see bounding boxes with confidence scores, then choose to save with a barangay + location note or discard.
- **Video Upload** — Upload dashcam footage. Use **Scan All Frames** (analyzes every 2 seconds, prompts to save after) or **Live Detection** (real-time preview only — never saves).
- **Live Stream / Webcam** — Real-time detection preview while the camera runs. When you stop, you are prompted to save the session with a location.
- **Severity Classification** — High, Medium, or Low based on pothole size relative to the frame.
- **Full Image Viewer** — Click "View Full Image" on any detection to open a full-screen overlay with bounding boxes.
- **Dashboard** — Quick stats (Total, Today, This Week, Critical), daily detection chart, and today's report sorted by priority (High → Medium → Low).
- **Detection History** — Trend charts and tables across 1 Week, 1 Month, 6 Months, or 1 Year.
- **Daily Reports** — Download today's detections as a CSV sorted by priority anytime.
- **CSV Alert System** — Generate per-barangay CSV reports for any period. Send via email or download directly.
- **Barangay Management** — 10 Quezon City barangays pre-configured. Add or edit in Settings.
- **Supabase Storage** — Every saved image/video is archived with a public URL.

---

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Frontend  | React 19, Vite 8, React Router DOM 7          |
| Backend   | Python, Flask, Flask-CORS                     |
| Detection | YOLOv8 (Ultralytics) — pothole weights        |
| Database  | Supabase (PostgreSQL)                         |
| Storage   | Supabase Storage (pothole-media bucket)       |
| Email     | SMTP — Brevo (recommended), Gmail, or Outlook |

---

## Project Structure

```
SOFTDESBG6/
├── backend/
│   ├── App.py                  # Flask API
│   ├── .env                    # Environment variables (DO NOT commit)
│   ├── Requirements.txt        # Python dependencies
│   └── weights/
│       └── best.pt             # YOLOv8 pothole model (MIT License)
│
├── frontend/
│   ├── public/
│   │   └── samples/            # Optional: sample .mp4 files
│   ├── vite.config.js          # Proxies /api/* → localhost:5000
│   └── src/
│       ├── App.jsx
│       ├── AppLayout.jsx
│       ├── Sidebar.jsx
│       ├── Login.jsx
│       ├── Register.jsx
│       ├── Dashboard.jsx
│       ├── ImageUpload.jsx     # Detect → view full image → save or discard
│       ├── VideoUpload.jsx     # Scan (save prompt) or Live Preview (no save)
│       ├── Webcam.jsx          # Live preview → stop → save or discard
│       ├── Settings.jsx
│       └── Index.css
│
└── supabase_setup.sql          # Run once in Supabase SQL Editor
```

---

## Database Schema

### `pothole_detections`
| Column         | Type        | Description                             |
|----------------|-------------|-----------------------------------------|
| id             | UUID        | Primary key                             |
| detected_at    | TIMESTAMPTZ | Timestamp of detection                  |
| severity       | TEXT        | High / Medium / Low                     |
| confidence     | FLOAT       | YOLO confidence (0–100)                 |
| bbox           | JSONB       | Bounding box [x, y, w, h]             |
| source         | TEXT        | image / video / webcam / dashcam        |
| image_url      | TEXT        | Supabase Storage public URL             |
| video_url      | TEXT        | Supabase Storage public URL             |
| frame_number   | INTEGER     | Frame index (video detections)          |
| barangay       | TEXT        | Barangay name                           |
| location_label | TEXT        | Free-text location note                 |

### `barangay_alert_config`
| Column          | Type        | Description                          |
|-----------------|-------------|--------------------------------------|
| barangay_name   | TEXT        | Unique barangay identifier           |
| recipient_email | TEXT        | Alert email address                  |
| alert_threshold | INTEGER     | Potholes before alert triggers       |
| is_active       | BOOLEAN     | Whether alerts are enabled           |
| last_alerted_at | TIMESTAMPTZ | Last time an alert was sent          |

### `alert_history` — log of all sent email reports
### `daily_reports` — aggregated daily detection summaries

---

## API Endpoints

| Method | Endpoint                      | Description                                        |
|--------|-------------------------------|----------------------------------------------------|
| GET    | `/health`                     | Server health check                                |
| POST   | `/api/pothole/detect`         | Detect in image. `analyze_only=true` skips saving |
| POST   | `/api/pothole/detect-webcam`  | Detect from base64 frame                           |
| POST   | `/api/pothole/detect-video`   | Process full video and save to DB                  |
| GET    | `/api/stats/dashboard`        | Quick stats: total, today, week, critical          |
| GET    | `/api/stats/history`          | History by period + charts                         |
| GET    | `/api/reports/daily`          | Today's report sorted by priority                  |
| GET    | `/api/reports/daily/download` | Download daily CSV                                 |
| GET    | `/api/barangays`              | List all barangay configs                          |
| POST   | `/api/barangays`              | Add or update barangay config                      |
| POST   | `/api/alerts/generate`        | Generate CSV + optionally email it                 |
| POST   | `/api/alerts/download-csv`    | Download CSV directly                              |
| GET    | `/api/alerts/history`         | View past alert sends                              |
| GET    | `/api/storage/status`         | Storage file counts and bucket paths               |

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/SOFTDESBG6.git
cd SOFTDESBG6
```

### 2. Supabase Setup

1. Go to your Supabase project → **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase_setup.sql` → **Run**
3. Go to **Storage** → confirm `pothole-media` bucket exists
4. Copy your **Project URL** and **Service Role Key** from **Settings → API**

> **Note:** PostgreSQL does not support `CREATE POLICY IF NOT EXISTS`. The script uses `DROP POLICY IF EXISTS` then `CREATE POLICY` — safe to run multiple times.

### 3. Configure Backend

```bash
cd backend

# Windows
python -m venv venv
.\venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate

pip install -r Requirements.txt
```

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_smtp_password
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SSL=false

PORT=5000
```

Place model weights at:
```
backend/weights/best.pt
```
Download from: https://github.com/Nocluee100/Pothole_Detection_AI_YOLO

### 4. Run Backend

```bash
cd backend
.\venv\Scripts\activate
python App.py
```

Wait for:
```
✅ Supabase connected
✅ Loaded: .../weights/best.pt
Running on http://0.0.0.0:5000
```

### 5. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: **http://localhost:5173**

> Vite proxies all `/api/*` requests to `localhost:5000` automatically — no extra CORS setup needed.

### 6. Sample Videos (optional)

Place `.mp4` files from the [Mendeley Pothole Dataset](https://data.mendeley.com/datasets/5bwfg4v4cd/3) into `frontend/public/samples/` named `sample1.mp4` through `sample5.mp4`.

---

## Email Setup

Email is **optional**. Without it, CSV reports can still be downloaded manually from Settings.

### Option A: Brevo — Recommended (Free, No 2FA Required)

Free tier: 300 emails/day. Works with any email address.

1. Sign up at [app.brevo.com](https://app.brevo.com)
2. Go to **Profile → SMTP & API → SMTP tab**
3. Copy your **Login** and **Password** (looks like `xsmtpib-abc123...`)

```env
SMTP_EMAIL=your_brevo_login@example.com
SMTP_PASSWORD=xsmtpib-your_brevo_key
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SSL=false
```

### Option B: Gmail App Password

Requires 2FA. Not available on school/organization Google accounts.

1. Go to [myaccount.google.com](https://myaccount.google.com) → Security → 2-Step Verification → ON
2. Search "App passwords" → create one → copy the 16-character code

```env
SMTP_EMAIL=your_gmail@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SSL=true
```

### Option C: Outlook / Hotmail

```env
SMTP_EMAIL=you@outlook.com
SMTP_PASSWORD=your_outlook_password
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SSL=false
```

---

## How Saving Works

Detections are **never saved automatically**. Every mode follows this flow:

| Mode | Detection | Saving |
|------|-----------|--------|
| **Image Upload** | Runs immediately on upload | Prompted after: select barangay + location → Save or Discard |
| **Video — Scan All Frames** | Scans every 2 seconds | Prompted after scan: select barangay + location → Save or Discard |
| **Video — Live Detection** | Preview while playing | **Never saved** — display only |
| **Webcam / Live Stream** | Preview while camera runs | Prompted after stopping: select barangay + location → Save or Discard |

---

## Where Do the Barangays Come From?

The 10 barangays are Quezon City barangays pre-loaded by `supabase_setup.sql` into the `barangay_alert_config` table:

- Barangay Holy Spirit · Barangay Batasan Hills · Barangay Commonwealth
- Barangay Fairview · Barangay Novaliches · Barangay Payatas
- Barangay Bagong Silangan · Barangay Tandang Sora · Barangay Culiat
- Barangay Matandang Balara

To add more or change recipient emails: **Settings → Barangay Alerts → Add / Update Barangay**.

---

## Technical Flow

```
User uploads image / video / webcam frame
        ↓
Flask → YOLOv8 runs detection
        ↓
If analyze_only=true → return detections only (nothing saved)
        ↓
User reviews bounding boxes on screen
        ↓
User selects barangay + location → clicks Save
        ↓
Flask uploads to Supabase Storage
Saves detections to pothole_detections table
Updates daily_reports aggregate
Dashboard reflects new data
```

### Severity Classification

| Severity | Condition                        |
|----------|----------------------------------|
| High     | Pothole area > 4% of frame       |
| Medium   | Pothole area 1.5% – 4% of frame  |
| Low      | Pothole area < 1.5% of frame     |

---

## Running Every Session

You need **two terminals** running at the same time:

**Terminal 1 — Backend:**
```bash
cd backend
.\venv\Scripts\activate
python App.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**

---

## .gitignore

```
backend/.env
backend/venv/
backend/weights/best.pt
frontend/node_modules/
```

---

## Attribution

- YOLO model: [Nocluee100/Pothole_Detection_AI_YOLO](https://github.com/Nocluee100/Pothole_Detection_AI_YOLO) — MIT License
- Sample videos: [Mendeley Pothole Dataset 5bwfg4v4cd](https://data.mendeley.com/datasets/5bwfg4v4cd/3)
- Detection framework: [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)

---

## License

MIT License — see LICENSE file for details.