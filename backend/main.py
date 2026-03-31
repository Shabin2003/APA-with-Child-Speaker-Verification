import io
import os
import tempfile
import random
import numpy as np
import librosa
import torch
import torch.nn.functional as F

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from transformers import (
    Wav2Vec2ForCTC,
    Wav2Vec2Processor,
    Wav2Vec2Model,
    pipeline
)

from pymongo import MongoClient
from scipy.spatial.distance import cosine
from jiwer import wer, cer

# ==============================
# FIREBASE ADMIN SDK
# ==============================

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

# Place your downloaded serviceAccountKey.json in the backend/ folder
# (same directory as main.py) and it will be picked up automatically.
SERVICE_ACCOUNT_PATH = os.path.join(
    os.path.dirname(__file__), "serviceAccountKey.json"
)

cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred)

print("Firebase Admin SDK initialised — project:", cred.project_id)

# ==============================
# TOKEN VERIFICATION DEPENDENCY
# ==============================

bearer_scheme = HTTPBearer()

def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — extracts and verifies the Firebase ID token
    sent in the Authorization: Bearer <token> header.

    Returns the decoded token dict (contains uid, email, etc.).
    Raises HTTP 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token has expired. Please log in again.",
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )

# ==============================
# DEVICE SETUP
# ==============================

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ==============================
# LOAD MODELS (ONCE)
# ==============================

print("Loading models...")

processor = Wav2Vec2Processor.from_pretrained(
    "facebook/wav2vec2-base-960h"
)

asr_model = Wav2Vec2ForCTC.from_pretrained(
    "facebook/wav2vec2-base-960h"
).to(DEVICE)

embed_model = Wav2Vec2Model.from_pretrained(
    "facebook/wav2vec2-base"
).to(DEVICE)

generator = pipeline(
    "text-generation",
    model="gpt2",
    device=0 if torch.cuda.is_available() else -1
)

asr_model.eval()
embed_model.eval()

print("Models loaded on:", DEVICE)

# ==============================
# DATABASE
# ==============================

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)

db = client["ai_voice_system"]

speaker_collection     = db["speakers"]
pronunciation_collection = db["pronunciation"]

# ==============================
# FASTAPI INIT
# ==============================

app = FastAPI()

# allow_origins=["*"] and allow_credentials=True cannot be used together —
# browsers reject it. Use explicit origin reflection instead.
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

class CORSHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        origin = request.headers.get("origin", "")

        # Handle preflight immediately
        if request.method == "OPTIONS":
            return StarletteResponse(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": origin or "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Max-Age": "86400",
                }
            )

        response = await call_next(request)
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

app.add_middleware(CORSHandlerMiddleware)

# Global exception handler — ensures CORS headers are present even on 500s
# so the browser shows the actual error instead of a CORS block
from fastapi.responses import JSONResponse
from fastapi.requests import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    origin = request.headers.get("origin", "")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin or "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

# ==============================
# UTILITY FUNCTIONS
# ==============================

def preprocess_audio(path, sr=16000):

    y, _ = librosa.load(path, sr=sr)

    y = librosa.effects.trim(y, top_db=25)[0]

    y = y / (np.max(np.abs(y)) + 1e-9)

    return y


def extract_embedding(audio):

    inputs = processor(
        audio,
        sampling_rate=16000,
        return_tensors="pt"
    )

    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = embed_model(**inputs)

    emb = outputs.last_hidden_state.mean(dim=1)

    return emb.squeeze().cpu().numpy()


def verify_speaker(test_emb, enrolled_embeddings, age):

    sims = [1 - cosine(test_emb, e) for e in enrolled_embeddings]

    similarity = max(sims)

    threshold = 0.65 if age < 12 else 0.75

    decision = "ACCEPT" if similarity > threshold else "REJECT"

    eer = 1 - similarity

    return similarity, eer, decision


def analyze_pronunciation(audio, text):
    try:
        audio = audio.astype(np.float32)
        audio = audio / (np.max(np.abs(audio)) + 1e-9)
        audio, _ = librosa.effects.trim(audio, top_db=20)

        # Safety check — audio too short after trimming
        if len(audio) < 1600:  # less than 0.1 seconds at 16kHz
            return {
                "transcript": "",
                "reference": text,
                "wer": 1.0,
                "cer": 1.0,
                "accuracy": 0.0,
            }

        inputs = processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt"
        ).to(DEVICE)

        with torch.no_grad():
            logits = asr_model(**inputs).logits
            probs = F.softmax(logits, dim=-1)
            pred_ids = torch.argmax(probs, dim=-1)

        transcript = processor.batch_decode(pred_ids)[0].lower().strip()

        # Handle empty transcript
        if not transcript:
            return {
                "transcript": "",
                "reference": text,
                "wer": 1.0,
                "cer": 1.0,
                "accuracy": 0.0,
            }

        w = float(wer(text.lower(), transcript))
        c = float(cer(text.lower(), transcript))
        accuracy = float(max(0.0, min(100.0, (1 - w) * 100)))

        return {
            "transcript": transcript,
            "reference":  text,
            "wer":        w,
            "cer":        c,
            "accuracy":   accuracy,
        }

    except Exception as e:
        print(f"[analyze_pronunciation] Error: {e}")
        return {
            "transcript": "",
            "reference":  text,
            "wer":        1.0,
            "cer":        1.0,
            "accuracy":   0.0,
        }

# ==============================
# TEXT GENERATION — Agno + Groq
# ==============================

import json as _json
from agno.agent import Agent
from agno.models.groq import Groq as GroqModel

# ── Static fallback pool ───────────────────────────────────────────────────────
# These are used when the FastAPI server is unreachable OR the Groq call fails.
# New sentences generated by the agent are appended here at runtime so the pool
# grows over time. The frontend also caches these locally.
FALLBACK_POOL: dict[str, list[dict]] = {
    "Easy": [
        {"sentence": "The cat sits on the mat.", "fact": "Cats sleep up to 16 hours a day.", "tip": "Stress 'cat' and 'mat' clearly."},
        {"sentence": "Birds fly in the sky.", "fact": "Birds have hollow bones to help them fly.", "tip": "Pronounce 'fly' with a long 'i' sound."},
        {"sentence": "The sun gives us light.", "fact": "The sun is a giant ball of hot gas.", "tip": "Stress 'sun' and 'light'."},
    ],
    "Medium": [
        {"sentence": "The children played happily in the park.", "fact": "Playing outside boosts creativity.", "tip": "Stress 'hap-pi-ly' — three syllables."},
        {"sentence": "She reads interesting books every night.", "fact": "Reading improves vocabulary and memory.", "tip": "Pronounce 'in-ter-est-ing' clearly."},
        {"sentence": "The Amazon River flows through Brazil.", "fact": "The Amazon is the largest river by volume.", "tip": "Say 'Am-a-zon' with stress on first syllable."},
    ],
    "Hard": [
        {"sentence": "Scientists discovered extraordinary phenomena in the deep ocean.", "fact": "Over 80% of the ocean remains unexplored.", "tip": "Break 'ex-tra-or-di-na-ry' into five parts."},
        {"sentence": "Technology has dramatically transformed global communication networks.", "fact": "The internet connects over 5 billion people.", "tip": "Stress 'trans-FORMED' and 'com-mu-ni-CA-tion'."},
        {"sentence": "The constitutional amendment strengthened democratic institutions worldwide.", "fact": "Democracy traces back to ancient Athens.", "tip": "Slow down on 'con-sti-tu-tion-al' — 5 syllables."},
    ],
}

# Map frontend difficulty levels to age groups for the agent prompt
LEVEL_TO_AGE = {
    "Easy":   "7-10",
    "Medium": "11-14",
    "Hard":   "15-18",
}

# Agno agent with Groq LLM
_agent = Agent(
    model=GroqModel(id="llama-3.1-8b-instant"),
    instructions=[
        "You are a children's pronunciation, vocabulary, and knowledge coach.",
        """Generate age-appropriate speaking content to improve pronunciation, vocabulary, and general knowledge.

Input: Age Group, Difficulty.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no explanation:
{
  "sentence": "One short engaging sentence linked to a real-world fact.",
  "fact": "One simple accurate fact about the sentence topic.",
  "tip": "Brief pronunciation tip — sounds, stress, mouth movement.",
  "words": ["key", "words", "from", "sentence"]
}

Rules:
- Easy (7-10): 6-10 words
- Medium (11-14): 10-15 words  
- Hard (15-18): 15-25 words
- Use simple language. Output ONLY the JSON object."""
    ],
    markdown=False,
)

def _parse_agent_response(raw: str) -> dict | None:
    """Extract JSON from agent response, tolerating markdown fences."""
    raw = raw.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        data = _json.loads(raw)
        if "sentence" in data:
            return data
    except Exception:
        pass
    return None

def generate_sentence(level: str = "Medium") -> dict:
    """
    Generate a sentence using Agno+Groq. Falls back to FALLBACK_POOL if the
    agent fails. Successful results are appended to FALLBACK_POOL so the pool
    grows over time.
    """
    age_group = LEVEL_TO_AGE.get(level, "11-14")

    try:
        response = _agent.run(f"Age group: {age_group}, Difficulty: {level}")
        data = _parse_agent_response(response.content)

        if data and data.get("sentence"):
            # Append to runtime fallback pool (grows during session)
            FALLBACK_POOL.setdefault(level, []).append(data)
            return data

    except Exception as e:
        print(f"[generate_sentence] Groq agent failed: {e}")

    # Fall back to static pool
    pool = FALLBACK_POOL.get(level, FALLBACK_POOL["Medium"])
    return random.choice(pool)

# ── Kokoro TTS ─────────────────────────────────────────────────────────────────

_tts_pipeline = None
_tts_available = False

def _get_tts():
    global _tts_pipeline, _tts_available
    if _tts_pipeline is None:
        try:
            from kokoro import KPipeline
            _tts_pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
            _tts_available = True
            print("Kokoro TTS loaded")
        except Exception as e:
            print(f"Kokoro TTS not available: {e}")
            _tts_available = False
    return _tts_pipeline, _tts_available

def generate_tts_audio(sentence: str, sentence_id: str) -> str | None:
    """
    Generate TTS audio for the sentence using Kokoro and save to disk.
    Returns the file path, or None if TTS is unavailable.
    Audio files are stored in backend/audio/ and served as static files.
    """
    pipe, available = _get_tts()
    if not available or pipe is None:
        return None

    try:
        import soundfile as sf
        import numpy as np

        audio_dir = os.path.join(os.path.dirname(__file__), "audio")
        os.makedirs(audio_dir, exist_ok=True)
        out_path = os.path.join(audio_dir, f"{sentence_id}.wav")

        if os.path.exists(out_path):
            return out_path  # Already generated, reuse

        chunks = []
        for _, _, audio_chunk in pipe(sentence, voice="af_heart"):
            chunks.append(audio_chunk)

        if chunks:
            audio = np.concatenate(chunks)
            sf.write(out_path, audio, 24000)
            return out_path

    except Exception as e:
        print(f"[TTS] Failed for '{sentence_id}': {e}")

    return None

# Sentences collection in MongoDB — stores generated sentences + audio paths
sentences_collection = db["sentences"]

# ==============================
# HEALTH CHECK  (public — no auth)
# ==============================

@app.get("/")
def root():

    return {
        "message": "AI Voice System API running",
        "device": DEVICE
    }

# ==============================
# GENERATE PRACTICE TEXT  (public — no auth)
# ==============================

from fastapi.staticfiles import StaticFiles
import hashlib

# Serve generated TTS audio files as static files at /audio/*
_audio_dir = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(_audio_dir, exist_ok=True)
app.mount("/audio", StaticFiles(directory=_audio_dir), name="audio")

@app.get("/generate-text")
def generate_text(level: str = "Medium", age: int = None):
    """
    Returns a sentence generated by Agno+Groq (or fallback if unavailable).
    Also generates TTS audio via Kokoro and stores sentence in MongoDB.
    Response includes the sentence text, fact, tip, and optional audio_url.
    """
    data = generate_sentence(level)
    sentence = data.get("sentence", "")

    # Stable ID for this sentence so we don't regenerate audio on repeat requests
    sentence_id = hashlib.md5(sentence.encode()).hexdigest()[:12]

    # Check MongoDB cache first
    cached = sentences_collection.find_one({"sentence_id": sentence_id}, {"_id": 0})
    if cached:
        return cached

    # Generate TTS audio
    audio_path = generate_tts_audio(sentence, sentence_id)
    audio_url = f"/audio/{sentence_id}.wav" if audio_path else None

    # Build response
    result = {
        "sentence":   sentence,
        "fact":       data.get("fact", ""),
        "tip":        data.get("tip", ""),
        "words":      data.get("words", []),
        "level":      level,
        "audio_url":  audio_url,
        "sentence_id": sentence_id,
    }

    # Save to MongoDB for caching and admin use
    sentences_collection.update_one(
        {"sentence_id": sentence_id},
        {"$set": result},
        upsert=True
    )

    return result

@app.get("/sentences/pool")
def get_sentence_pool():
    """
    Returns all cached sentences from MongoDB grouped by level.
    Used by the frontend to build its offline fallback pool.
    """
    docs = list(sentences_collection.find({}, {"_id": 0}))
    pool = {}
    for doc in docs:
        lvl = doc.get("level", "Medium")
        pool.setdefault(lvl, []).append(doc)
    return pool

# ==============================
# PRONUNCIATION ANALYSIS  (protected)
# ==============================

@app.post("/pronunciation/analyze")
async def pronunciation_analyze(
    text: str = Form(...),
    file: UploadFile = File(...),
    token: dict = Depends(verify_firebase_token),
):
    import asyncio
    uid = token["uid"]

    try:
        audio_bytes = await file.read()
        # Use soundfile backend as fallback — handles more formats (m4a, webm, ogg)
        try:
            audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)
        except Exception:
            # Write to temp file so librosa can use ffmpeg for exotic formats
            suffix = "." + (file.filename.split(".")[-1] if file.filename else "wav")
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            audio, sr = librosa.load(tmp_path, sr=16000)
            os.unlink(tmp_path)

        loop = asyncio.get_event_loop()
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(None, analyze_pronunciation, audio, text),
                timeout=300,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="Pronunciation analysis timed out. Try a shorter recording.",
            )

        pronunciation_collection.insert_one({**result, "uid": uid})

        return {
            "transcript": str(result["transcript"]),
            "reference":  str(result["reference"]),
            "wer":        float(result["wer"]),
            "cer":        float(result["cer"]),
            "accuracy":   float(result["accuracy"]),
        }

    except HTTPException:
        raise
    except Exception as e:
        # Log the full traceback so it appears in Colab output
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

# ==============================
# PRONUNCIATION + VERIFY  (protected)
# Runs ASR scoring and speaker verification in parallel on the same audio.
# Returns pronunciation results + identity verification in one response.
# ==============================

@app.post("/pronunciation/analyze-and-verify")
async def pronunciation_analyze_and_verify(
    text: str = Form(...),
    age: int = Form(...),
    file: UploadFile = File(...),
    token: dict = Depends(verify_firebase_token),
):
    """
    Combined endpoint: runs pronunciation scoring (Wav2Vec2 ASR) and
    speaker verification (embedding cosine similarity) in parallel on the
    same audio blob. Returns both results in a single response so the
    frontend can show identity status alongside the pronunciation score.
    """
    import asyncio

    uid = token["uid"]

    try:
        audio_bytes = await file.read()

        # Load audio once, share between both tasks
        try:
            audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)
        except Exception:
            suffix = "." + (file.filename.split(".")[-1] if file.filename and "." in file.filename else "wav")
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            audio, sr = librosa.load(tmp_path, sr=16000)
            os.unlink(tmp_path)

        if len(audio) < 1600:
            return {
                "transcript": "", "reference": text,
                "wer": 1.0, "cer": 1.0, "accuracy": 0.0,
                "verified": False, "similarity": 0.0, "eer": 1.0,
                "verification_status": "audio_too_short",
            }

        loop = asyncio.get_event_loop()

        # ── Task 1: Pronunciation ASR ──────────────────────────────────────────
        async def run_pronunciation():
            try:
                return await asyncio.wait_for(
                    loop.run_in_executor(None, analyze_pronunciation, audio, text),
                    timeout=300,
                )
            except asyncio.TimeoutError:
                return {"transcript": "", "reference": text, "wer": 1.0, "cer": 1.0, "accuracy": 0.0}
            except Exception as e:
                print(f"[pronunciation] Error: {e}")
                return {"transcript": "", "reference": text, "wer": 1.0, "cer": 1.0, "accuracy": 0.0}

        # ── Task 2: Speaker verification ───────────────────────────────────────
        async def run_verification():
            try:
                speaker = speaker_collection.find_one({"speaker_id": uid})
                if not speaker or not speaker.get("embeddings"):
                    return {"verified": False, "similarity": 0.0, "eer": 1.0, "verification_status": "not_enrolled"}

                def _verify():
                    test_emb = extract_embedding(audio)
                    enrolled = [np.array(e) for e in speaker["embeddings"]]
                    sim, eer, decision = verify_speaker(test_emb, enrolled, age)
                    return float(sim), float(eer), decision

                sim, eer, decision = await asyncio.wait_for(
                    loop.run_in_executor(None, _verify),
                    timeout=60,
                )
                return {
                    "verified":             decision == "ACCEPT",
                    "similarity":           sim,
                    "eer":                  eer,
                    "verification_status":  decision,
                }
            except asyncio.TimeoutError:
                return {"verified": False, "similarity": 0.0, "eer": 1.0, "verification_status": "timeout"}
            except Exception as e:
                print(f"[verification] Error: {e}")
                return {"verified": False, "similarity": 0.0, "eer": 1.0, "verification_status": "error"}

        # Run both in parallel
        pron_result, verif_result = await asyncio.gather(
            run_pronunciation(),
            run_verification(),
        )

        # Save to MongoDB
        pronunciation_collection.insert_one({
            **pron_result,
            "uid":              uid,
            "verified":         verif_result["verified"],
            "similarity":       verif_result["similarity"],
            "verification_status": verif_result["verification_status"],
        })

        return {
            "transcript":           str(pron_result.get("transcript", "")),
            "reference":            str(pron_result.get("reference", text)),
            "wer":                  float(pron_result.get("wer", 1.0)),
            "cer":                  float(pron_result.get("cer", 1.0)),
            "accuracy":             float(pron_result.get("accuracy", 0.0)),
            "verified":             verif_result["verified"],
            "similarity":           verif_result["similarity"],
            "eer":                  verif_result["eer"],
            "verification_status":  verif_result["verification_status"],
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# ==============================
# ASR TRANSCRIBE  (protected)
# Quick transcription endpoint used by FruitsNaming, ColoursMatching,
# and BODMAS — returns just the transcript text, no scoring.
# ==============================

@app.post("/asr/transcribe")
async def asr_transcribe(
    file: UploadFile = File(...),
    token: dict = Depends(verify_firebase_token),
):
    """
    Transcribes audio using Wav2Vec2 ASR and returns the raw transcript.
    Used by game modules (fruits, colours, BODMAS) that do their own
    answer matching logic client-side.
    """
    import asyncio

    try:
        audio_bytes = await file.read()

        try:
            audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)
        except Exception:
            suffix = "." + (file.filename.split(".")[-1] if file.filename and "." in file.filename else "wav")
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            audio, sr = librosa.load(tmp_path, sr=16000)
            os.unlink(tmp_path)

        if len(audio) < 1600:
            return {"transcript": "", "error": "Audio too short"}

        def _transcribe(audio):
            audio = audio.astype(np.float32)
            audio = audio / (np.max(np.abs(audio)) + 1e-9)
            inputs = processor(audio, sampling_rate=16000, return_tensors="pt").to(DEVICE)
            with torch.no_grad():
                logits = asr_model(**inputs).logits
                pred_ids = torch.argmax(logits, dim=-1)
            return processor.batch_decode(pred_ids)[0].lower().strip()

        loop = asyncio.get_event_loop()
        transcript = await asyncio.wait_for(
            loop.run_in_executor(None, _transcribe, audio),
            timeout=60,
        )
        return {"transcript": transcript}

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Transcription timed out.")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# ==============================
# SPEAKER ENROLLMENT  (protected)
# ==============================

@app.post("/speaker/enroll")
async def enroll_speaker(
    speaker_id: str = Form(...),
    age: int = Form(...),
    file: UploadFile = File(...),
    token: dict = Depends(verify_firebase_token),   # ← Firebase auth
):
    uid = token["uid"]

    # Enforce that a user can only enroll under their own UID
    if speaker_id != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="speaker_id must match your Firebase UID.",
        )

    with tempfile.NamedTemporaryFile(delete=False) as tmp:

        content = await file.read()

        tmp.write(content)

        path = tmp.name

    audio = preprocess_audio(path)

    emb = extract_embedding(audio)

    speaker_collection.update_one(
        {"speaker_id": speaker_id},
        {"$push": {"embeddings": emb.tolist()}},
        upsert=True
    )

    return {
        "status": "enrolled",
        "speaker_id": speaker_id
    }

# ==============================
# SPEAKER VERIFICATION  (protected)
# ==============================

@app.post("/speaker/verify")
async def verify_speaker_api(
    speaker_id: str = Form(...),
    age: int = Form(...),
    file: UploadFile = File(...),
    token: dict = Depends(verify_firebase_token),   # ← Firebase auth
):
    uid = token["uid"]

    # Users can only verify their own profile
    if speaker_id != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="speaker_id must match your Firebase UID.",
        )

    speaker = speaker_collection.find_one(
        {"speaker_id": speaker_id}
    )

    if not speaker:

        return {"error": "speaker not enrolled"}

    with tempfile.NamedTemporaryFile(delete=False) as tmp:

        content = await file.read()

        tmp.write(content)

        path = tmp.name

    audio = preprocess_audio(path)

    test_emb = extract_embedding(audio)

    enrolled = [np.array(e) for e in speaker["embeddings"]]

    similarity, eer, decision = verify_speaker(
        test_emb,
        enrolled,
        age
    )

    return {
        "speaker_id": speaker_id,
        "similarity": float(similarity),
        "eer": float(eer),
        "decision": decision
    }

# ==============================
# USER PROFILE  (protected)
# ==============================

from fastapi import Body
from datetime import datetime, timezone

users_collection = db["users"]

# Ensure enrollment_number is unique across all students (sparse = allows nulls)
users_collection.create_index(
    "enrollment_number",
    unique=True,
    sparse=True,
    name="unique_enrollment_number"
)

@app.post("/user/profile")
async def save_profile(
    full_name: str = Body(...),
    email: str = Body(...),
    role: str = Body(...),
    enrollment_number: str = Body(None),
    token: dict = Depends(verify_firebase_token),
):
    uid = token["uid"]
    now = datetime.now(timezone.utc).isoformat()

    # Check enrollment number uniqueness before saving
    if enrollment_number:
        existing = users_collection.find_one(
            {"enrollment_number": enrollment_number, "uid": {"$ne": uid}}
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Enrollment number '{enrollment_number}' is already taken. Please use a different one.",
            )

    try:
        users_collection.update_one(
            {"uid": uid},
            {"$set": {
                "uid": uid,
                "full_name": full_name,
                "email": email,
                "role": role,
                "enrollment_number": enrollment_number,
                "updated_at": now,
            }, "$setOnInsert": {"created_at": now}},
            upsert=True
        )
    except Exception as e:
        # Catch MongoDB duplicate key error as a fallback
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Enrollment number '{enrollment_number}' is already taken.",
            )
        raise

    doc = users_collection.find_one({"uid": uid}, {"_id": 0})
    return doc


@app.get("/user/profile")
async def get_profile(
    token: dict = Depends(verify_firebase_token),
):
    uid = token["uid"]
    doc = users_collection.find_one({"uid": uid}, {"_id": 0})

    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Merge enrollment flag from speakers collection
    speaker = speaker_collection.find_one({"speaker_id": uid})
    doc["enrolled"] = speaker is not None and len(speaker.get("embeddings", [])) >= 3

    return doc


# ==============================
# ADMIN — ALL STUDENTS  (protected, teacher only)
# ==============================

@app.get("/admin/students")
async def get_all_students(
    token: dict = Depends(verify_firebase_token),
):
    uid = token["uid"]

    # Verify caller is a teacher
    caller = users_collection.find_one({"uid": uid})
    if not caller or caller.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can access the student list.",
        )

    students = list(users_collection.find({"role": "student"}, {"_id": 0}))

    result = []
    for student in students:
        sid = student["uid"]

        # Fetch assessments for this student
        assessments = list(
            pronunciation_collection.find(
                {"uid": sid},
                {"_id": 0, "transcript": 0, "reference": 0}
            ).sort("assessed_at", -1).limit(20)
        )

        accuracies = [a["accuracy"] for a in assessments if "accuracy" in a]
        avg = round(sum(accuracies) / len(accuracies)) if accuracies else None

        result.append({
            **student,
            "assessments": assessments,
            "avgAccuracy": avg,
            "totalSessions": len(assessments),
        })

    return result
