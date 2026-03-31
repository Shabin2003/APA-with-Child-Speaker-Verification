# Firebase Setup Guide

## What Firebase is used for in this project

- **Firebase Auth only** — handles login, signup, and token generation
- **MongoDB** — stores everything else (user profiles, voice embeddings, assessments)
- **No Firestore needed** — skip that entirely

---

## 1. Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → give it a name → Continue
3. Disable Google Analytics (optional) → **Create project**

---

## 2. Enable Email/Password Authentication

1. In your project go to **Build → Authentication → Get started**
2. Click **Email/Password** → Enable → Save
3. Click **Google** → Enable → add your Project support email → Save

That's all you need in the Firebase Console for the frontend.

---

## 3. Get your Web App config keys (for the frontend `.env`)

1. Go to **Project Settings** (gear icon top-left)
2. Under **Your apps** click the **`</>`** web icon → Register app
3. Copy the values from the `firebaseConfig` object shown

Then open the `.env` file in the project root and fill them in:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_API_URL=http://localhost:8000
```

These keys let the browser call Firebase Auth (login/signup). They do NOT touch MongoDB or Firestore.

---

## 4. Get your Service Account key (for the backend `main.py`)

1. In **Project Settings** → **Service accounts** tab
2. Click **Generate new private key** → Download the JSON file
3. Rename it `serviceAccountKey.json`
4. Place it in the `backend/` folder (same folder as `main.py`)

The FastAPI backend uses this to verify the Firebase ID token sent with every request.

---

## 5. Run the app

**Backend:**
```bash
cd backend
pip install firebase-admin
uvicorn main:app --reload
```

**Frontend:**
```bash
bun install
bun run dev
```

Open http://localhost:5173

---

## How data flows

```
Browser (React)
  │
  ├─ Login/Signup ──────────────► Firebase Auth
  │                                    │
  │                               ID Token (JWT)
  │                                    │
  └─ All other requests ──────────────►FastAPI (main.py)
                                       │  verifies token with
                                       │  firebase-admin + serviceAccountKey.json
                                       │
                                       └──► MongoDB
                                             ├── users        (profiles)
                                             ├── speakers     (voice embeddings)
                                             └── pronunciation (assessment results)
```

---

## MongoDB collections (created automatically)

| Collection      | What's stored                                     |
|----------------|---------------------------------------------------|
| `users`         | Full name, email, role, enrollment number, age    |
| `speakers`      | Voice embeddings per student (uid as speaker_id)  |
| `pronunciation` | Transcript, accuracy, WER, CER per assessment     |

---

## Teacher Admin Panel

- Teachers log in with an email from the whitelist in `src/config/adminEmails.ts`
- The admin panel at `/admin` calls `GET /admin/students` on FastAPI
- FastAPI checks the caller's role in MongoDB before returning student data
