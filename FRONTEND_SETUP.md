# Frontend Setup Guide

## Configuration

### 1. Update Environment Variables

Edit `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://kinsjetblanofxkagcjv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=https://your-ngrok-url.ngrok.io
```

**VITE_API_URL Options:**

- **Local Development**: `http://localhost:8000`
- **Colab with ngrok**: `https://abc123.ngrok.io` (from Colab output)
- **Production Server**: Your deployed API URL

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The app will start at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

## Features

### Speaker Enrollment
1. Enter your name and age
2. Choose video or audio-only recording
3. Record 3 voice samples reading provided sentences
4. System stores voice embeddings in MongoDB

### Speaker Verification
1. Enter your speaker ID (from enrollment)
2. Record a verification sample
3. System compares voice with enrolled profile
4. Get confidence score and verification result

### Pronunciation Assessment
1. Choose difficulty level (Beginner/Intermediate/Advanced)
2. Record yourself reading the sentence
3. Get detailed feedback:
   - Accuracy percentage
   - Word Error Rate (WER)
   - Character Error Rate (CER)
   - Your transcript vs reference

## API Endpoints

Your FastAPI server should have these endpoints:

```
GET  /
POST /speaker/enroll
POST /speaker/verify
POST /pronunciation/analyze
GET  /generate-text
```

All endpoints handle CORS and accept form data with audio files.

## Troubleshooting

### "Failed to fetch" errors
- Check `VITE_API_URL` is correct
- Ensure FastAPI server is running
- Check browser console for CORS errors
- Verify ngrok URL hasn't changed

### "API not responding"
- Colab notebook still running? (server disconnects after timeout)
- Internet connection stable?
- ngrok might need restarting

### No camera/microphone access
- Allow browser permissions when prompted
- Use HTTPS for better compatibility (ngrok provides this)
- Audio-only mode doesn't require camera

### Recording issues
- Check browser console for WebRTC errors
- Try different browser if issues persist
- Clear browser cache

## Browser Compatibility

- Chrome/Chromium: Excellent
- Firefox: Good
- Safari: Good (iOS 14.5+)
- Edge: Excellent

## API Integration Notes

The frontend makes requests to these endpoints with form-data:

**Speaker Enrollment:**
```
POST /speaker/enroll
- speaker_id: string
- age: integer
- file: audio/video blob
```

**Speaker Verification:**
```
POST /speaker/verify
- speaker_id: string
- age: integer
- file: audio/video blob
```

**Pronunciation Analysis:**
```
POST /pronunciation/analyze
- text: string (sentence to read)
- file: audio/video blob
```

All files are extracted from video/audio blobs captured via browser MediaRecorder.
