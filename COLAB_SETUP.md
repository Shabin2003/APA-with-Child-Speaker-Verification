# Running FastAPI Server in Google Colab

This guide explains how to run your FastAPI voice AI server in Google Colab and connect it to your frontend.

## Prerequisites

- Google Colab account
- MongoDB Atlas account (free tier available)
- Your FastAPI `backend/main.py` code

## Step 1: Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Get your MongoDB connection string: `mongodb+srv://username:password@cluster.mongodb.net/ai_voice_system`
4. Keep this string for later

## Step 2: Create Colab Notebook

Create a new notebook in Google Colab with the following cells:

### Cell 1: Install Dependencies

```python
!pip install fastapi uvicorn python-multipart
!pip install librosa torch transformers scipy jiwer
!pip install pymongo
!pip install pyngrok
```

### Cell 2: Install ngrok for Public URL

```python
!pip install pyngrok
```

### Cell 3: Set Environment Variables

```python
import os
from google.colab import userdata

# Get your MongoDB URI from Colab Secrets
MONGO_URI = userdata.get('MONGO_URI')
os.environ['MONGO_URI'] = MONGO_URI

print("✓ MongoDB URI configured")
```

**To add secrets to Colab:**
1. Click the "Key" icon on the left sidebar
2. Click "Add new secret"
3. Name: `MONGO_URI`
4. Value: Your MongoDB connection string
5. Toggle "Notebook access" ON

### Cell 4: Upload Your Backend Code

```python
# Option A: Upload from local
from google.colab import files
uploaded = files.upload()

# Option B: Clone from git (if you have a repo)
# !git clone https://github.com/yourusername/your-repo.git
# %cd your-repo
```

### Cell 5: Create FastAPI Application

If you uploaded your `main.py`, run this:

```python
%cd /content  # Or wherever you uploaded the code

# Import and run your main.py
exec(open('main.py').read())
```

Alternatively, paste the entire `main.py` content directly.

### Cell 6: Expose with ngrok (Public URL)

```python
from pyngrok import ngrok
import threading

# Get ngrok auth token from: https://dashboard.ngrok.com/auth
NGROK_AUTH_TOKEN = userdata.get('NGROK_AUTH_TOKEN')
ngrok.set_auth_token(NGROK_AUTH_TOKEN)

# Create public URL for FastAPI
public_url = ngrok.connect(8000)
print(f"\n✓ Public FastAPI URL: {public_url}")
print(f"✓ Use this URL in your frontend as VITE_API_URL")
```

**To get ngrok token:**
1. Go to [ngrok Dashboard](https://dashboard.ngrok.com)
2. Sign up for free
3. Copy your auth token
4. Add it as a Colab Secret named `NGROK_AUTH_TOKEN`

### Cell 7: Start FastAPI Server

```python
import uvicorn
import threading

# Run in background thread
def run_server():
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

print("✓ FastAPI server starting...")
print("✓ Keep this cell running to maintain the connection")

# Keep the cell alive
import time
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Server stopped")
```

## Step 3: Update Frontend Configuration

Update `.env` in your frontend:

```env
VITE_SUPABASE_URL=https://kinsjetblanofxkagcjv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=https://your-ngrok-url.ngrok.io
```

Replace `https://your-ngrok-url.ngrok.io` with the URL from Cell 6.

## Step 4: Test the Connection

Once the Colab server is running and you have the ngrok URL:

1. Copy the public URL from ngrok (e.g., `https://abc123.ngrok.io`)
2. Update `VITE_API_URL` in `.env`
3. Restart your frontend dev server (`npm run dev`)
4. Test the API by visiting: `https://your-ngrok-url.ngrok.io/`

You should see:
```json
{
  "message": "AI Voice System API running",
  "device": "cuda" or "cpu"
}
```

## Complete Colab Template

Here's a complete minimal Colab notebook:

```python
# Cell 1: Install all dependencies
!pip install fastapi uvicorn python-multipart librosa torch transformers scipy jiwer pymongo pyngrok

# Cell 2: Setup
import os
import sys
from google.colab import userdata
import threading
import time

MONGO_URI = userdata.get('MONGO_URI')
NGROK_AUTH_TOKEN = userdata.get('NGROK_AUTH_TOKEN')

os.environ['MONGO_URI'] = MONGO_URI

from pyngrok import ngrok
ngrok.set_auth_token(NGROK_AUTH_TOKEN)
public_url = ngrok.connect(8000)
print(f"Public API URL: {public_url}")

# Cell 3: Paste your main.py code here
# (Copy entire content of backend/main.py)
# ... main.py content ...

# Cell 4: Start server
import uvicorn

def run_server():
    uvicorn.run(app, host='0.0.0.0', port=8000)

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

print("✓ Server running")
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopped")
```

## Troubleshooting

### "ModuleNotFoundError"
Make sure all dependencies are installed in Cell 1.

### "ngrok error"
- Verify your auth token is correct
- Add it as a Colab secret, not hardcoded

### "Connection refused"
- Check the FastAPI server is running (Cell 7 still executing)
- Verify the ngrok URL is correct
- Check `VITE_API_URL` matches the ngrok URL

### "CORS errors"
The FastAPI server already has CORS configured, so this shouldn't occur.

### "Connection timeout"
- Colab sessions timeout after 30 minutes of inactivity
- Keep the notebook open
- The ngrok connection will persist as long as the Colab session is active

## Important Notes

1. **Colab Sessions**: Free Colab notebooks disconnect after 30 minutes of inactivity. Keep your notebook open while using the frontend.

2. **GPU**: Request GPU in Colab for faster inference:
   - Runtime → Change runtime type → Hardware accelerator → GPU

3. **MongoDB Connection**: Ensure your MongoDB cluster allows connections from Colab (whitelist 0.0.0.0/0 in Network Access)

4. **ngrok URL Changes**: Each time you restart the notebook, you get a new ngrok URL. Update `VITE_API_URL` accordingly.

5. **Production**: For production, use:
   - Cloud Run, Railway, or Hugging Face Spaces for hosting
   - Environment variables for sensitive data
   - Proper error handling and logging

## Next Steps

1. Set up MongoDB Atlas and get connection string
2. Get ngrok auth token
3. Create Colab notebook with above code
4. Get public URL from ngrok
5. Update frontend `.env` with the URL
6. Start using your voice AI app!
