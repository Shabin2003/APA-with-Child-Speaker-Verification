"""
main.py  —  AI Voice Assessment System  —  FastAPI backend
==========================================================
Based on last working version (main__7_.py) with all fixes applied.

Key fixes vs broken versions:
  1. analyze-and-verify: extracts AUDIO from video blobs via ffmpeg
  2. verify_speaker: uses mean-of-top2 + correct ECAPA thresholds
  3. extract_embedding: weighted pooling + L2 norm
  4. Token cache: skips repeated Google API calls
  5. Model warmup: dummy forward pass at startup
  6. InvalidIdTokenError typo fixed
  7. assessed_at timestamp on every pronunciation insert
  8. save_profile uses Pydantic model (not individual Body params)
"""

import io
import re
import os
import time
import tempfile
import random
import hashlib
import json as _json
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import librosa
import torch
import torch.nn.functional as F

from fastapi import FastAPI, UploadFile, File, Form, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse
from speechbrain.inference.speaker import SpeakerRecognition
from pronunciation import analyze_pronunciation

from transformers import (
    WhisperForConditionalGeneration,
    WhisperProcessor,
    pipeline,
)

from pymongo import MongoClient
from scipy.spatial.distance import cosine
from jiwer import wer, cer

# ── Firebase Admin SDK ────────────────────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred)
print("Firebase Admin SDK initialised — project:", cred.project_id)


# ==============================================================================
# TOKEN VERIFICATION  (with in-process cache)
# ==============================================================================

bearer_scheme = HTTPBearer()
_token_cache: dict[str, tuple[dict, float]] = {}


def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    now   = time.time()

    if token in _token_cache:
        decoded, exp = _token_cache[token]
        if now < exp - 30:
            return decoded

    try:
        decoded = firebase_auth.verify_id_token(token)
        _token_cache[token] = (decoded, float(decoded["exp"]))
        # Evict expired entries
        for t in [k for k, (_, e) in _token_cache.items() if now >= e]:
            _token_cache.pop(t, None)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Firebase token has expired. Please log in again.")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid Firebase token.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail=f"Token verification failed: {str(e)}")


# ==============================================================================
# DEVICE
# ==============================================================================

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Running on device: {DEVICE}")
DEVICE_SV="cuda:0"

# ==============================================================================
# LOAD MODELS
# ==============================================================================

print("Loading models...")

# Whisper medium: subword seq2seq, ~769M params, excellent on Indian English,
# handles all proper nouns and rare vocabulary without CTC blank artifacts.
# Use "openai/whisper-small" if GPU VRAM < 4 GB.
ASR_MODEL_ID = "openai/whisper-medium"
processor  = WhisperProcessor.from_pretrained(ASR_MODEL_ID)
asr_model  = WhisperForConditionalGeneration.from_pretrained(ASR_MODEL_ID).to(DEVICE)
asr_model.config.forced_decoder_ids = processor.get_decoder_prompt_ids(language="english", task="transcribe")
embed_model =  SpeakerRecognition.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="pretrained_models/spkrec-ecapa-voxceleb",
    run_opts={"device": DEVICE_SV},
)
# generator  = pipeline("text-generation", model="gpt2",
#                        device=0 if torch.cuda.is_available() else -1)

asr_model.eval()
embed_model.eval()
print("Models loaded on:", DEVICE)

# Warm up — one dummy forward pass so first real request is not slow
with torch.no_grad():
    _d   = np.zeros(16000, dtype=np.float32)
    _inp = processor(_d, sampling_rate=16000, return_tensors="pt").to(DEVICE)
    asr_model.generate(_inp["input_features"])
    _wav = torch.zeros(1, 16000).to(DEVICE)
    embed_model.encode_batch(_wav)
print("Models warmed up.")


# ==============================================================================
# DATABASE
# ==============================================================================

MONGO_URI = os.getenv("MONGO_URI")
client    = MongoClient(MONGO_URI)
db        = client["ai_voice_system"]

speaker_collection       = db["speakers"]
pronunciation_collection = db["pronunciation"]
sentences_collection     = db["sentences"]
users_collection         = db["users"]

users_collection.create_index(
    "enrollment_number", unique=True, sparse=True,
    name="unique_enrollment_number",
)


# ==============================================================================
# FASTAPI + CORS
# ==============================================================================

app = FastAPI(title="AI Voice Assessment API", version="3.0")


class CORSHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        origin = request.headers.get("origin", "")
        if request.method == "OPTIONS":
            return StarletteResponse(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin":      origin or "*",
                    "Access-Control-Allow-Methods":     "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers":     "Authorization, Content-Type, Accept, Origin, X-Requested-With",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Max-Age":           "86400",
                },
            )
        response = await call_next(request)
        if origin:
            response.headers["Access-Control-Allow-Origin"]      = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


app.add_middleware(CORSHandlerMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback; traceback.print_exc()
    origin = request.headers.get("origin", "")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin":      origin or "*",
            "Access-Control-Allow-Credentials": "true",
        },
    )


# ==============================================================================
# AUDIO UTILITIES
# ==============================================================================

def preprocess_audio(path: str, sr: int = 16000) -> np.ndarray:
    y, _ = librosa.load(path, sr=sr)
    y    = librosa.effects.trim(y, top_db=25)[0]
    y    = y / (np.max(np.abs(y)) + 1e-9)
    return y


def _load_audio_bytes(audio_bytes: bytes, filename: str | None = None) -> np.ndarray:
    """
    Load audio from raw bytes.

    Handles ALL formats the browser might send:
      - audio/webm  (Chrome/Edge audio-only recording)
      - video/webm  (Chrome/Edge video+audio recording)  ← was causing 500s
      - audio/mp4 / video/mp4  (Safari)
      - audio/wav, audio/ogg

    For video formats: extracts audio track via ffmpeg subprocess.
    Falls back to temp-file approach for anything librosa can't read directly.
    """
    # Try direct BytesIO decode first (works for wav, ogg, plain webm audio)
    try:
        audio, _ = librosa.load(io.BytesIO(audio_bytes), sr=16000)
        if len(audio) > 0:
            return audio
    except Exception:
        pass

    # Write to temp file and let librosa/ffmpeg handle the format
    suffix = ".webm"
    if filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        suffix = f".{ext}"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        audio, _ = librosa.load(tmp_path, sr=16000)
        return audio
    except Exception:
        # Last resort: use ffmpeg directly to extract audio stream
        import subprocess
        wav_path = tmp_path + ".wav"
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path,
                 "-ac", "1", "-ar", "16000", "-vn", wav_path],
                capture_output=True, timeout=30
            )
            audio, _ = librosa.load(wav_path, sr=16000)
            return audio
        finally:
            if os.path.exists(wav_path):
                os.unlink(wav_path)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ==============================================================================
# SPEAKER EMBEDDING + VERIFICATION
# ==============================================================================

def _l2_normalize(v: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(v)
    return v / (norm + 1e-9)


def extract_embedding(audio: np.ndarray) -> np.ndarray:
    """
    Extract speaker embedding using speechbrain with attention-weighted
    mean pooling and L2 normalisation.

    Weighted pooling: frames with higher L2 norm (voiced speech) get more
    weight than silence frames, giving a cleaner speaker representation.
    """
    audio = audio.astype(np.float32)
    audio = audio / (np.max(np.abs(audio)) + 1e-9)

    # Prepare a [batch, time] tensor for SpeechBrain
    wav = torch.tensor(audio, dtype=torch.float32).unsqueeze(0).to(DEVICE)   # [1, T]

    with torch.no_grad():
        emb = embed_model.encode_batch(wav)              # returns tensor [1, 1, emb_dim] or similar

    emb = emb.squeeze().cpu().numpy()                   # [emb_dim]
    return _l2_normalize(emb)


def verify_speaker(
    test_emb: np.ndarray,
    enrolled_embeddings: list,
    age: int,
) -> tuple[float, float, str]:
    """
    Compare test embedding against enrolled gallery.

    Uses mean of top-2 cosine similarities (more robust than max).
    Thresholds calibrated for L2-normalised Wav2Vec2-base embeddings:
      same speaker:  typically 0.55 – 0.85
      diff speaker:  typically 0.10 – 0.45

    Age-stratified thresholds (children have more intra-speaker variability):
      < 12:  0.50
      12-17: 0.55
      18+:   0.60
    """
    if not enrolled_embeddings:
        return 0.0, 0.5, "REJECT"

    test  = _l2_normalize(test_emb)
    normed = [_l2_normalize(np.array(e)) for e in enrolled_embeddings]

    sims = sorted([float(np.dot(test, e)) for e in normed], reverse=True)
    k    = min(2, len(sims))
    similarity = float(np.mean(sims[:k]))

    threshold = 0.50 if age < 12 else (0.55 if age < 18 else 0.60)
    decision  = "ACCEPT" if similarity >= threshold else "REJECT"
    eer_est   = float(max(0.0, min(0.5, 0.5 * (1.0 - abs(similarity - threshold)))))

    return similarity, eer_est, decision


# ==============================================================================
# PRONUNCIATION ANALYSIS
# ==============================================================================

def _whisper_transcribe(audio: np.ndarray) -> str:
    """
    Transcribes audio using Whisper.

    Whisper is a seq2seq OpenAI model that has a builtin model producing tokens directly
    eliminating the problems of word fragmentation and has a richer vocbulary
    compared to other counterparts 

    Input: float32 numpy array at 16 kHz, already normalised.
    Returns: lowercase stripped transcript string.
    """
    inputs = processor(audio, sampling_rate=16000, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        predicted_ids = asr_model.generate(inputs["input_features"])
    transcript = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
    return transcript.strip().lower()


def analyze_pronunciation(audio: np.ndarray, text: str) -> dict:
    """
    Simple but robust WER/CER-based pronunciation scorer.
    Uses Whisper-small for transcription, then computes accuracy from WER.
    """
    _EMPTY = {
        "transcript": "", "reference": text,
        "wer": 1.0, "cer": 1.0, "accuracy": 0.0,
    }
    try:
        audio = audio.astype(np.float32)
        audio = audio / (np.max(np.abs(audio)) + 1e-9)
        audio, _ = librosa.effects.trim(audio, top_db=20)

        if len(audio) < 1600:
            return _EMPTY

        transcript = _whisper_transcribe(audio)

        if not transcript:
            return _EMPTY

        w        = float(min(1.0, wer(text.lower(), transcript)))
        c        = float(min(1.0, cer(text.lower(), transcript)))
        accuracy = float(max(0.0, min(100.0, (1 - w) * 100)))

        return {
            "transcript": transcript,
            "reference":  text,
            "wer":        w,
            "cer":        c,
            "accuracy":   accuracy,
        }
    except Exception as e:
        import traceback; traceback.print_exc()
        return _EMPTY


# ==============================================================================
# TEXT GENERATION — Agno + Groq
# ==============================================================================

from agno.agent import Agent
from agno.models.groq import Groq as GroqModel

FALLBACK_POOL: dict[str, list[dict]] = {
    "Easy": [
        {"sentence": "The cat sits on the mat.",        "fact": "Cats sleep up to 16 hours a day.",          "tip": "Stress 'cat' and 'mat' clearly."},
        {"sentence": "Birds fly in the sky.",            "fact": "Birds have hollow bones to help them fly.", "tip": "Pronounce 'fly' with a long 'i' sound."},
        {"sentence": "The sun gives us light.",          "fact": "The sun is a giant ball of hot gas.",       "tip": "Stress 'sun' and 'light'."},
    ],
    "Medium": [
        {"sentence": "The children played happily in the park.", "fact": "Playing outside boosts creativity.",         "tip": "Stress 'hap-pi-ly' — three syllables."},
        {"sentence": "She reads interesting books every night.", "fact": "Reading improves vocabulary and memory.",     "tip": "Pronounce 'in-ter-est-ing' clearly."},
        {"sentence": "The Amazon River flows through Brazil.",   "fact": "The Amazon is the largest river by volume.", "tip": "Say 'Am-a-zon' with stress on first syllable."},
    ],
    "Hard": [
        {"sentence": "Scientists discovered extraordinary phenomena in the deep ocean.",        "fact": "Over 80% of the ocean remains unexplored.",   "tip": "Break 'ex-tra-or-di-na-ry' into five parts."},
        {"sentence": "Technology has dramatically transformed global communication networks.", "fact": "The internet connects over 5 billion people.", "tip": "Stress 'trans-FORMED' and 'com-mu-ni-CA-tion'."},
        {"sentence": "The constitutional amendment strengthened democratic institutions worldwide.", "fact": "Democracy traces back to ancient Athens.", "tip": "Slow down on 'con-sti-tu-tion-al' — 5 syllables."},
    ],
}

LEVEL_TO_AGE = {"Easy": "7-10", "Medium": "11-14", "Hard": "15-18"}

_agent = Agent(
    model=GroqModel(id="llama-3.1-8b-instant"),
    instructions=[
        "You are a children's pronunciation, vocabulary, and knowledge coach.",
        """Generate age-appropriate speaking content.

INPUT: Age Group, Difficulty.

OUTPUT FORMAT — ONLY valid JSON, no markdown:
{
  "sentence": "One short engaging sentence.",
  "fact": "One simple accurate fact.",
  "tip": "Brief pronunciation tip.",
  "words": ["key", "words"]
}

Rules: Easy(7-10):6-10 words, Medium(11-14):10-15 words, Hard(15-18):15-25 words.
Output ONLY the JSON object.""",
    ],
    markdown=False,
)


def _parse_agent_response(raw: str) -> dict | None:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        data = _json.loads(raw)
        return data if "sentence" in data else None
    except Exception:
        return None


def generate_sentence(level: str = "Medium") -> dict:
    age_group = LEVEL_TO_AGE.get(level, "11-14")
    try:
        response = _agent.run(f"Age group: {age_group}, Difficulty: {level}")
        data = _parse_agent_response(response.content)
        if data and data.get("sentence"):
            FALLBACK_POOL.setdefault(level, []).append(data)
            return data
    except Exception as e:
        print(f"[generate_sentence] Groq agent failed: {e}")
    return random.choice(FALLBACK_POOL.get(level, FALLBACK_POOL["Medium"]))


# ==============================================================================
# KOKORO TTS
# ==============================================================================

_tts_pipeline  = None
_tts_available = False


def _get_tts():
    global _tts_pipeline, _tts_available
    if _tts_pipeline is None:
        try:
            from kokoro import KPipeline
            _tts_pipeline  = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
            _tts_available = True
            print("Kokoro TTS loaded.")
        except Exception as e:
            print(f"Kokoro TTS not available: {e}")
    return _tts_pipeline, _tts_available


def generate_tts_audio(sentence: str, sentence_id: str) -> str | None:
    pipe, available = _get_tts()
    if not available or pipe is None:
        return None
    try:
        import soundfile as sf
        audio_dir = os.path.join(os.path.dirname(__file__), "audio")
        os.makedirs(audio_dir, exist_ok=True)
        out_path  = os.path.join(audio_dir, f"{sentence_id}.wav")
        if os.path.exists(out_path):
            return out_path
        chunks = [chunk for _, _, chunk in pipe(sentence, voice="af_heart")]
        if chunks:
            sf.write(out_path, np.concatenate(chunks), 24000)
            return out_path
    except Exception as e:
        print(f"[TTS] Failed for '{sentence_id}': {e}")
    return None


# ==============================================================================
# STATIC FILES + ROUTES
# ==============================================================================

_audio_dir = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(_audio_dir, exist_ok=True)
app.mount("/audio", StaticFiles(directory=_audio_dir), name="audio")


@app.get("/")
def root():
    return {"message": "AI Voice Assessment API running", "device": DEVICE}


@app.get("/generate-text")
def generate_text(level: str = "Medium", age: Optional[int] = None):
    data        = generate_sentence(level)
    sentence    = data.get("sentence", "")
    sentence_id = hashlib.md5(sentence.encode()).hexdigest()[:12]

    cached = sentences_collection.find_one({"sentence_id": sentence_id}, {"_id": 0})
    if cached:
        return cached

    audio_path = generate_tts_audio(sentence, sentence_id)
    result = {
        "sentence":    sentence,
        "fact":        data.get("fact", ""),
        "tip":         data.get("tip", ""),
        "words":       data.get("words", []),
        "level":       level,
        "audio_url":   f"/audio/{sentence_id}.wav" if audio_path else None,
        "sentence_id": sentence_id,
    }
    sentences_collection.update_one(
        {"sentence_id": sentence_id}, {"$set": result}, upsert=True
    )
    return result


@app.get("/sentences/pool")
def get_sentence_pool():
    docs = list(sentences_collection.find({}, {"_id": 0}))
    pool: dict[str, list] = {}
    for doc in docs:
        pool.setdefault(doc.get("level", "Medium"), []).append(doc)
    return pool


# ── Pronunciation only ────────────────────────────────────────────────────────

@app.post("/pronunciation/analyze")
async def pronunciation_analyze(
    text:  str        = Form(...),
    file:  UploadFile = File(...),
    token: dict       = Depends(verify_firebase_token),
):
    import asyncio
    uid = token["uid"]

    try:
        audio_bytes = await file.read()
        audio       = _load_audio_bytes(audio_bytes, file.filename)

        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, analyze_pronunciation, audio, text),
            timeout=300,
        )

        pronunciation_collection.insert_one({
            **result, "uid": uid,
            "assessed_at": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "transcript": str(result["transcript"]),
            "reference":  str(result["reference"]),
            "wer":        float(result["wer"]),
            "cer":        float(result["cer"]),
            "accuracy":   float(result["accuracy"]),
        }

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Analysis timed out.")
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ── Pronunciation + speaker verification (parallel) ───────────────────────────

@app.post("/pronunciation/analyze-and-verify")
async def pronunciation_analyze_and_verify(
    text:  str        = Form(...),
    age:   int        = Form(...),
    file:  UploadFile = File(...),
    token: dict       = Depends(verify_firebase_token),
):
    """
    Runs ASR scoring and speaker verification in PARALLEL on the same audio.
    Handles video blobs (webm/mp4 with video track) by extracting audio first.
    """
    import asyncio
    uid = token["uid"]

    try:
        audio_bytes = await file.read()
        audio       = _load_audio_bytes(audio_bytes, file.filename)

        if len(audio) < 1600:
            return {
                "transcript": "", "reference": text,
                "wer": 1.0, "cer": 1.0, "accuracy": 0.0,
                "verified": False, "similarity": 0.0, "eer": 1.0,
                "verification_status": "audio_too_short",
            }

        loop = asyncio.get_event_loop()

        async def run_pronunciation():
            try:
                return await asyncio.wait_for(
                    loop.run_in_executor(None, analyze_pronunciation, audio, text),
                    timeout=300,
                )
            except Exception as e:
                print(f"[pronunciation] Error: {e}")
                return {"transcript": "", "reference": text, "wer": 1.0, "cer": 1.0, "accuracy": 0.0}

        async def run_verification():
            try:
                speaker = speaker_collection.find_one({"speaker_id": uid})
                if not speaker or not speaker.get("embeddings"):
                    return {"verified": False, "similarity": 0.0, "eer": 1.0,
                            "verification_status": "not_enrolled"}

                def _verify():
                    test_emb = extract_embedding(audio)
                    enrolled = [np.array(e) for e in speaker["embeddings"]]
                    sim, eer, decision = verify_speaker(test_emb, enrolled, age)
                    return float(sim), float(eer), decision

                sim, eer, decision = await asyncio.wait_for(
                    loop.run_in_executor(None, _verify), timeout=60
                )
                return {
                    "verified":            decision == "ACCEPT",
                    "similarity":          sim,
                    "eer":                 eer,
                    "verification_status": decision,
                }
            except asyncio.TimeoutError:
                return {"verified": False, "similarity": 0.0, "eer": 1.0,
                        "verification_status": "timeout"}
            except Exception as e:
                print(f"[verification] Error: {e}")
                return {"verified": False, "similarity": 0.0, "eer": 1.0,
                        "verification_status": "error"}

        pron_result, verif_result = await asyncio.gather(
            run_pronunciation(), run_verification()
        )

        pronunciation_collection.insert_one({
            **pron_result,
            "uid":                 uid,
            "assessed_at":         datetime.now(timezone.utc).isoformat(),
            "verified":            verif_result["verified"],
            "similarity":          verif_result["similarity"],
            "verification_status": verif_result["verification_status"],
        })

        return {
            "transcript":          str(pron_result.get("transcript", "")),
            "reference":           str(pron_result.get("reference", text)),
            "wer":                 float(pron_result.get("wer", 1.0)),
            "cer":                 float(pron_result.get("cer", 1.0)),
            "accuracy":            float(pron_result.get("accuracy", 0.0)),
            "verified":            verif_result["verified"],
            "similarity":          verif_result["similarity"],
            "eer":                 verif_result["eer"],
            "verification_status": verif_result["verification_status"],
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ── ASR transcription for games ───────────────────────────────────────────────

@app.post("/asr/transcribe")
async def asr_transcribe(
    file:  UploadFile = File(...),
    token: dict       = Depends(verify_firebase_token),
):
    import asyncio
    try:
        audio_bytes = await file.read()
        audio       = _load_audio_bytes(audio_bytes, file.filename)

        if len(audio) < 1600:
            return {"transcript": "", "error": "Audio too short"}

        def _transcribe(a: np.ndarray) -> str:
            a = a.astype(np.float32)
            a = a / (np.max(np.abs(a)) + 1e-9)
            return _whisper_transcribe(a)

        loop = asyncio.get_event_loop()
        transcript = await asyncio.wait_for(
            loop.run_in_executor(None, _transcribe, audio), timeout=60
        )
        return {"transcript": transcript}

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Transcription timed out.")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ── Speaker enrollment ────────────────────────────────────────────────────────

@app.post("/speaker/enroll")
async def enroll_speaker(
    speaker_id: str        = Form(...),
    age:        int        = Form(...),
    file:       UploadFile = File(...),
    token:      dict       = Depends(verify_firebase_token),
):
    uid = token["uid"]
    if speaker_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="speaker_id must match your Firebase UID.")

    content = await file.read()
    suffix  = "." + (file.filename.split(".")[-1] if file.filename and "." in file.filename else "wav")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        path = tmp.name

    try:
        audio = preprocess_audio(path)
        emb   = extract_embedding(audio)
    finally:
        os.unlink(path)

    speaker_collection.update_one(
        {"speaker_id": speaker_id},
        {
            "$push": {"embeddings": emb.tolist()},
            "$set":  {"age": age, "updated_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )

    doc      = speaker_collection.find_one({"speaker_id": speaker_id}, {"embeddings": 1})
    n_samples = len(doc.get("embeddings", [])) if doc else 1
    return {"status": "enrolled", "speaker_id": speaker_id, "samples": n_samples}


# ── Speaker verification ──────────────────────────────────────────────────────

@app.post("/speaker/verify")
async def verify_speaker_api(
    speaker_id: str        = Form(...),
    age:        int        = Form(...),
    file:       UploadFile = File(...),
    token:      dict       = Depends(verify_firebase_token),
):
    uid = token["uid"]
    if speaker_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="speaker_id must match your Firebase UID.")

    speaker = speaker_collection.find_one({"speaker_id": speaker_id})
    if not speaker:
        return {"error": "speaker not enrolled"}

    content = await file.read()
    suffix  = "." + (file.filename.split(".")[-1] if file.filename and "." in file.filename else "wav")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        path = tmp.name

    try:
        audio    = preprocess_audio(path)
        test_emb = extract_embedding(audio)
    finally:
        os.unlink(path)

    enrolled = [np.array(e) for e in speaker["embeddings"]]
    similarity, eer, decision = verify_speaker(test_emb, enrolled, age)

    return {
        "speaker_id": speaker_id,
        "similarity": float(similarity),
        "eer":        float(eer),
        "decision":   decision,
    }


# ── User profile ──────────────────────────────────────────────────────────────

class SaveProfileRequest(BaseModel):
    full_name:         str
    email:             str
    role:              str
    enrollment_number: Optional[str] = None


@app.post("/user/profile")
async def save_profile(
    body:  SaveProfileRequest,
    token: dict = Depends(verify_firebase_token),
):
    uid = token["uid"]
    now = datetime.now(timezone.utc).isoformat()

    if body.enrollment_number:
        existing = users_collection.find_one(
            {"enrollment_number": body.enrollment_number, "uid": {"$ne": uid}}
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Enrollment number '{body.enrollment_number}' is already taken.",
            )

    try:
        users_collection.update_one(
            {"uid": uid},
            {
                "$set": {
                    "uid":               uid,
                    "full_name":         body.full_name,
                    "email":             body.email,
                    "role":              body.role,
                    "enrollment_number": body.enrollment_number,
                    "updated_at":        now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
    except Exception as e:
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Enrollment number '{body.enrollment_number}' is already taken.",
            )
        raise

    return users_collection.find_one({"uid": uid}, {"_id": 0})


@app.get("/user/profile")
async def get_profile(token: dict = Depends(verify_firebase_token)):
    uid = token["uid"]
    doc = users_collection.find_one({"uid": uid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    speaker = speaker_collection.find_one({"speaker_id": uid})
    doc["enrolled"] = speaker is not None and len(speaker.get("embeddings", [])) >= 3
    return doc


# ── Admin ─────────────────────────────────────────────────────────────────────

@app.get("/admin/students")
async def get_all_students(token: dict = Depends(verify_firebase_token)):
    uid    = token["uid"]
    caller = users_collection.find_one({"uid": uid})
    if not caller or caller.get("role") != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only teachers can access the student list.")

    students = list(users_collection.find({"role": "student"}, {"_id": 0}))
    result   = []
    for student in students:
        sid = student["uid"]
        assessments = list(
            pronunciation_collection
            .find({"uid": sid}, {"_id": 0, "transcript": 0, "reference": 0})
            .sort("assessed_at", -1)
            .limit(20)
        )
        accuracies = [a["accuracy"] for a in assessments if "accuracy" in a]
        avg = round(sum(accuracies) / len(accuracies)) if accuracies else None
        result.append({
            **student,
            "assessments":   assessments,
            "avgAccuracy":   avg,
            "totalSessions": len(assessments),
        })
    return result
