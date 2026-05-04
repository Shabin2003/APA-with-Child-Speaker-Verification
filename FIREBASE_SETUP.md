# Firebase Setup Guide

## What Firebase is used for

- **Firebase Auth only** — handles login, signup, and JWT token generation
- **No Firestore, no Realtime Database, no Storage needed** — skip all of that
- **MongoDB** stores everything else: user profiles, voice embeddings, assessment results, sentence cache

---

## 1. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name (e.g. `apa-with-csv`) → Continue
3. Disable Google Analytics (optional) → **Create project**

---

## 2. Enable Authentication Providers

1. In your project go to **Build → Authentication → Get started**
2. Under the **Sign-in method** tab, enable:
   - **Email/Password** → Enable → Save
   - **Google** → Enable → add your Project support email → Save

That's all you need in the Firebase Console for the frontend.

---

## 3. Get your Web App config (for the frontend `.env`)

1. Go to **Project Settings** (gear icon ⚙️ top-left)
2. Under **Your apps** click the **`</>`** web icon → Register app → give it a nickname
3. Copy the values from the `firebaseConfig` object shown

Create or edit the `.env` file in the **project root** (same level as `package.json`):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_API_URL=http://localhost:8000
```

> **Note:** `VITE_API_URL` should point to your running FastAPI backend.  
> For Colab + Cloudflare Tunnel use the tunnel URL, e.g. `https://starting-breathing-dean-spring.trycloudflare.com`

These keys are safe to expose in a browser — they only allow calling Firebase Auth. They do **not** touch MongoDB.

---

## 4. Get the Service Account key (for the backend `main.py`)

The FastAPI backend uses this to **verify** the Firebase JWT sent with every request.

1. In **Project Settings** → **Service accounts** tab
2. Click **Generate new private key** → **Generate key** → download the JSON file
3. Rename it exactly: `serviceAccountKey.json`
4. Place it in the `backend/` folder — the same folder as `main.py`

```
backend/
├── main.py
├── serviceAccountKey.json   ← goes here
├── pronunciation.py
└── pretrained_models/
```

> ⚠️ **Never commit `serviceAccountKey.json` to git.** Add it to `.gitignore`.

---

## 5. Backend environment variable

The backend reads MongoDB URI from an environment variable. Set it before starting the server:

```bash
export MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority"
```

Or add it to a `backend/.env` file and load it with `python-dotenv`.

---

## 6. Run the application

**Backend (GPU server / Colab):**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Expected startup output:
```
Firebase Admin SDK initialised — project: your-project-id
Running on device: cuda
Loading models...
Models loaded on: cuda
Models warmed up.
```

**Frontend:**
```bash
# from project root
npm install        # or: bun install
npm run dev        # or: bun run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 7. How authentication flows

```
Browser (React)
  │
  ├─ Login / Signup ──────────────► Firebase Auth
  │                                      │
  │                                 ID Token (JWT, expires 1hr)
  │                                      │
  └─ Every API request ──────────────────► FastAPI backend (main.py)
                                          │
                                          │  verify_firebase_token()
                                          │  ├─ checks in-process token cache first
                                          │  └─ calls firebase_admin.verify_id_token()
                                          │       using serviceAccountKey.json
                                          │
                                          └──► MongoDB Atlas
                                                ├── users        (profiles + roles)
                                                ├── speakers     (ECAPA voice embeddings)
                                                ├── pronunciation (assessment history)
                                                └── sentences    (LLM sentence cache)
```

The backend maintains an **in-process token cache** — once a token is verified it is cached until 30 seconds before expiry, avoiding redundant Firebase API calls on every request.

---

## 8. MongoDB collections (auto-created on first write)

| Collection | What is stored |
|---|---|
| `users` | `uid`, `full_name`, `email`, `role` (`student`/`teacher`), `enrollment_number`, `created_at`, `updated_at` |
| `speakers` | `speaker_id` (= Firebase UID), `embeddings` (array of 192-dim ECAPA vectors), `age`, `updated_at` |
| `pronunciation` | `uid`, `transcript`, `reference`, `wer`, `cer`, `accuracy`, `verified`, `similarity`, `verification_status`, `assessed_at` |
| `sentences` | `sentence_id` (MD5 hash), `sentence`, `fact`, `tip`, `words`, `level`, `audio_url` |

A unique sparse index is automatically created on `enrollment_number` to prevent duplicates.

---

## 9. Teacher Admin Panel

- Teachers sign up with `role = teacher` (set during profile creation)
- The admin dashboard calls `GET /admin/students` — FastAPI checks `role == "teacher"` in MongoDB before returning any data
- Students need a minimum of **3 enrolled voice samples** before speaker verification is active (`enrolled: true` in their profile)

---

## 10. Re-enrollment after model change

If you switch the speaker verification model (e.g. change `spkrec-ecapa-voxceleb` to a different checkpoint), all stored embeddings become incompatible. Clear them with:

```bash
# Via the API (per user, authenticated)
curl -X DELETE https://your-api-url/speaker/reset \
  -H "Authorization: Bearer <firebase_id_token>"

# Or directly in MongoDB shell (wipes all users — dev only)
db.speakers.deleteMany({})
```

Every user must re-enroll (3+ samples) after this.
