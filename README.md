# 🎙️ Automatic Pronunciation Assessment with Child Speaker Verification (EXTENDED WITH GAMIFIED LEARNING)

An AI-powered pronunciation assessment and speaker verification platform for school-aged children. Students read AI-generated sentences aloud, hear correct pronunciation via TTS, and receive instant accuracy feedback. Their vocal identity is verified biometrically every session.

---

## ✨ Features

- **Pronunciation scoring** — Word Error Rate (WER) and Character Error Rate (CER) via OpenAI Whisper
- **Speaker verification** — ECAPA-TDNN biometric identity check on every assessment
- **AI sentence generation** — Groq Llama 3.1 generates age-appropriate sentences with facts and tips
- **TTS reference audio** — Kokoro 82M plays the correct pronunciation; falls back to browser speech synthesis
- **Three difficulty levels** — Easy (ages 7–10) · Medium (11–14) · Hard (15–18)
- **Two user roles** — Students and Teachers
- **Teacher dashboard** — View all students, session history, and average accuracy
- **Video or audio recording** — Students can record with or without camera
- **Offline sentence fallback** — Static pool used when LLM is unavailable

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client["Browser (React + TypeScript)"]
        UI["Student / Teacher UI"]
        MR["MediaRecorder API"]
    end

    subgraph Backend["FastAPI Backend (Python + CUDA)"]
        AUTH["Firebase JWT Middleware"]
        PRON["Pronunciation API"]
        ENROLL["Speaker Enroll API"]
        GEN["Text Generation API"]
    end

    subgraph ML["ML Models"]
        WHISPER["Whisper ASR"]
        ECAPA["ECAPA-TDNN Speaker Verification"]
        KOKORO["Kokoro TTS"]
        GROQ["Llama 3.1 Generator"]
    end

    subgraph Data["Persistence"]
        MONGO[("MongoDB Atlas")]
        FB["Firebase Auth"]
    end

    UI --> MR --> PRON
    UI --> ENROLL
    UI --> GEN

    AUTH --> FB

    PRON --> WHISPER
    PRON --> ECAPA
    ENROLL --> ECAPA
    GEN --> GROQ
    GEN --> KOKORO

    Backend --> MONGO
```

---

## 📁 Project Structure

```
project-root/
├── backend/
│   ├── main.py                    # FastAPI app — all endpoints and ML pipelines
│   ├── pronunciation.py           # Pronunciation analysis module
│   ├── serviceAccountKey.json     # Firebase service account (⚠️ not in git)
│   ├── pretrained_models/         # SpeechBrain ECAPA model weights (auto-downloaded)
│   │   └── spkrec-ecapa-voxceleb/
│   └── audio/                     # Kokoro TTS output files (auto-created)
│
├── src/
│   ├── lib/
│   │   ├── api.ts                 # All typed fetch wrappers for backend endpoints
│   │   └── firebase.ts            # Firebase app init
│   ├── contexts/
│   │   └── AuthContext.tsx        # Firebase Auth context + user profile state
│   ├── hooks/
│   │   ├── useAudioRecorder.ts    # Audio-only MediaRecorder hook
│   │   └── useVideoRecorder.ts    # Video+audio MediaRecorder hook
│   ├── components/
│   │   ├── PronunciationAssessment.tsx   # Main assessment flow
│   │   ├── SpeakerEnrollment.tsx         # Voice enrollment UI
│   │   ├── TeacherDashboard.tsx          # Admin student list
│   │   ├── AudioVisualizer.tsx           # Waveform visualiser
│   │   ├── RecordingControls.tsx         # Record/pause/stop buttons
│   │   ├── VideoPreview.tsx              # Live camera preview
│   │   └── ...
│   └── config/
│       └── adminEmails.ts         # Teacher email whitelist
│
├── .env                           # Environment variables (⚠️ not in git)
├── .env.example                   # Template — copy to .env and fill in
├── package.json
├── vite.config.ts
├── FIREBASE_SETUP.md
└── FRONTEND_SETUP.md
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+ with CUDA-capable GPU (for the backend)
- Node.js 18+ or Bun (for the frontend)
- MongoDB Atlas cluster
- Firebase project with Auth enabled
- Groq API key

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd <project-root>
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

```env
# .env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_API_URL=http://localhost:8000
```

### 2. Backend setup

```bash
cd backend

# Set MongoDB URI
export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/ai_voice_system"

# Set Groq API key (for sentence generation)
export GROQ_API_KEY="gsk_..."

# Install dependencies
pip install -r requirements.txt

# Place your Firebase service account key
# (download from Firebase Console → Project Settings → Service accounts)
cp ~/Downloads/your-project-firebase-adminsdk.json serviceAccountKey.json

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Frontend setup

```bash
# from project root
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 📦 Backend Dependencies

```txt
fastapi
uvicorn[standard]
uvloop
speechbrain
transformers
torch
torchaudio
librosa
numpy
scipy
jiwer
pymongo
firebase-admin
agno
groq
kokoro          # optional — TTS falls back to browser if unavailable
soundfile
python-multipart
```

---

## 🔑 Environment Variables Reference

| Variable | Where used | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase web app key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | Firebase messaging ID |
| `VITE_FIREBASE_APP_ID` | Frontend | Firebase app ID |
| `VITE_API_URL` | Frontend | FastAPI backend URL (no trailing slash) |
| `MONGO_URI` | Backend | MongoDB Atlas connection string |
| `GROQ_API_KEY` | Backend | Groq API key for Llama 3.1 |

---

## 🤖 ML Models

| Model | Source | Size | Purpose |
|---|---|---|---|
| OpenAI Whisper Medium | `openai/whisper-medium` (HuggingFace) | 769M | ASR transcription |
| ECAPA-TDNN | `speechbrain/spkrec-ecapa-voxceleb` (HuggingFace) | ~23M | Speaker embeddings (192-dim) |
| Kokoro 82M | `hexgrad/Kokoro-82M` (HuggingFace) | 82M | TTS reference audio |
| Llama 3.1 8B Instant | Groq Cloud API | — | Sentence generation |

Models are downloaded automatically on first run to `pretrained_models/`. Whisper and Kokoro weights are downloaded by HuggingFace `transformers` and `kokoro` libraries respectively.

> **GPU memory:** Whisper Medium requires ~2.5 GB VRAM. Use `openai/whisper-small` (~1 GB) if memory is limited — change `ASR_MODEL_ID` in `main.py`.

---

## 🗄️ Database Schema

**MongoDB database:** `ai_voice_system`

| Collection | Key fields |
|---|---|
| `users` | `uid` (Firebase UID), `full_name`, `email`, `role`, `enrollment_number`, `created_at` |
| `speakers` | `speaker_id` (= uid), `embeddings` (array of 192-dim floats), `age`, `updated_at` |
| `pronunciation` | `uid`, `transcript`, `reference`, `wer`, `cer`, `accuracy`, `verified`, `similarity`, `verification_status`, `assessed_at` |
| `sentences` | `sentence_id` (MD5), `sentence`, `fact`, `tip`, `words`, `level`, `audio_url` |

---

## 🔌 API Reference

All protected endpoints require `Authorization: Bearer <firebase_id_token>`.

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `GET /` | GET | — | Health check |
| `GET /generate-text` | GET | — | Generate sentence via LLM with TTS audio |
| `GET /sentences/pool` | GET | — | All cached sentences from MongoDB |
| `POST /pronunciation/analyze-and-verify` | POST | ✅ | ASR + speaker verification in parallel |
| `POST /pronunciation/analyze` | POST | ✅ | ASR pronunciation scoring only |
| `POST /asr/transcribe` | POST | ✅ | Raw transcription (for games) |
| `POST /speaker/enroll` | POST | ✅ | Add voice embedding to gallery |
| `POST /speaker/verify` | POST | ✅ | Standalone speaker verification |
| `DELETE /speaker/reset` | DELETE | ✅ | Clear all embeddings (re-enrollment) |
| `POST /user/profile` | POST | ✅ | Create or update user profile |
| `GET /user/profile` | GET | ✅ | Get authenticated user's profile |
| `GET /admin/students` | GET | ✅ Teacher | All students + assessment history |

---

## 🔐 Security

- All API requests are authenticated via **Firebase JWT tokens** verified server-side
- An **in-process token cache** prevents redundant Firebase API calls (expires 30s before token expiry)
- `speaker_id` is always validated to equal the authenticated user's `uid` — users cannot enroll or verify as other users
- The `/admin/students` endpoint checks `role == "teacher"` in MongoDB before returning any data
- `serviceAccountKey.json` must **never be committed to git** — add it to `.gitignore`

---

## 🎤 Speaker Verification Details

Verification uses a **dual-signal cosine similarity** approach:

1. **Centroid similarity** — cosine similarity between the test embedding and the mean of all enrolled embeddings
2. **Top-2 similarity** — mean of the two highest individual cosine scores

Final score = average of both signals.

**Age-stratified thresholds** (ECAPA cosine space):

| Age group | Threshold |
|---|---|
| Under 12 | 0.55 |
| 12–17 | 0.60 |
| 18+ | 0.65 |

A minimum of **3 enrollment samples** is required before verification is active.

> If you change the ECAPA model checkpoint, all stored embeddings become incompatible. Call `DELETE /speaker/reset` for each user and re-enroll.

---

## 📋 Setup Guides

- [**FIREBASE_SETUP.md**](./FIREBASE_SETUP.md) — Firebase project creation, Auth setup, service account key, MongoDB collections
- [**FRONTEND_SETUP.md**](./FRONTEND_SETUP.md) — Environment variables, running the dev server, features, troubleshooting

---

## 🛠️ Development Notes

### Running on Colab with Cloudflare Tunnel

```python
# In a Colab cell — install cloudflared and start tunnel
!wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared
!chmod +x cloudflared
import subprocess, threading

def run_tunnel():
    subprocess.run(["./cloudflared", "tunnel", "--url", "http://localhost:8000"])

threading.Thread(target=run_tunnel, daemon=True).start()
```

Copy the `trycloudflare.com` URL from the output and set it as `VITE_API_URL` in your `.env`.

### Re-enrollment workflow

```bash
# Reset a specific user (requires their Firebase ID token)
curl -X DELETE https://your-api/speaker/reset \
  -H "Authorization: Bearer <token>"

# Reset all users (MongoDB shell — dev only)
use ai_voice_system
db.speakers.deleteMany({})
```

### Changing ASR model

In `main.py`, change:

```python
ASR_MODEL_ID = "openai/whisper-medium"   # ~2.5 GB VRAM
# or
ASR_MODEL_ID = "openai/whisper-small"    # ~1 GB VRAM (lower accuracy)
# or
ASR_MODEL_ID = "openai/whisper-large-v3" # ~6 GB VRAM (highest accuracy)
```

---

## 📄 License

MIT
