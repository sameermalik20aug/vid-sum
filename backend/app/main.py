from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi
from transformers import pipeline
import os
import re
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="VidSum Backend")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1234"],  # Parcel dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize summarizer globally (loads model once at startup)
try:
    summarizer = pipeline(
        "summarization", 
        model="facebook/bart-large-cnn",
        device=-1  # Use CPU (-1) or 0 for GPU if available
    )
except Exception as e:
    print(f"Error loading summarization model: {e}")
    # Fallback to a lighter model if BART fails
    try:
        summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6")
    except Exception as e2:
        print(f"Fallback model also failed: {e2}")
        summarizer = None

class VideoRequest(BaseModel):
    video_url: str

def extract_video_id(url: str) -> str:
    """
    Extract YouTube video ID from various URL formats
    """
    # Handle different YouTube URL formats
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
        r'youtube\.com\/v\/([^&\n?#]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise ValueError("Invalid YouTube URL format")

def chunk_text(text: str, max_chunk_size: int = 1000) -> list:
    """
    Split text into chunks for summarization
    """
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    
    for word in words:
        if current_length + len(word) + 1 <= max_chunk_size:
            current_chunk.append(word)
            current_length += len(word) + 1
        else:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
            current_chunk = [word]
            current_length = len(word)
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks

@app.get("/")
async def root():
    return {"message": "VidSum Backend Running!"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": summarizer is not None
    }

@app.post("/summarize")
async def summarize_video(request: VideoRequest):
    if not summarizer:
        raise HTTPException(
            status_code=503, 
            detail="Summarization model not available. Check server logs."
        )
    
    try:
        # Extract video ID from YouTube URL
        video_id = extract_video_id(request.video_url)
        
        # Fetch transcript using the correct API (instance-based)
        try:
            # Create an instance of YouTubeTranscriptApi
            youtube_api = YouTubeTranscriptApi()
            
            # Use direct fetch method which is simpler and more reliable
            transcript_list = youtube_api.fetch(video_id, languages=['en'])
            
        except Exception as transcript_error:
            # Fallback: try different languages or the list method
            try:
                youtube_api = YouTubeTranscriptApi()
                
                # Try the list method as fallback
                transcript_list_obj = youtube_api.list(video_id)
                
                # Find English transcript
                english_transcript = None
                for transcript in transcript_list_obj:
                    if transcript.language_code.startswith('en'):
                        english_transcript = transcript.fetch()
                        break
                
                if english_transcript:
                    transcript_list = english_transcript
                else:
                    # Get first available transcript
                    transcript_list = next(iter(transcript_list_obj)).fetch()
                    
            except Exception as fallback_error:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No transcript available for this video: {str(transcript_error)}"
                )
        
        # Combine transcript entries - handle FetchedTranscript object
        if hasattr(transcript_list, 'snippets'):
            # transcript_list is a FetchedTranscript object
            transcript = " ".join([snippet.text for snippet in transcript_list.snippets])
        else:
            # Fallback for list format (shouldn't happen with new API, but just in case)
            transcript = " ".join([entry["text"] if isinstance(entry, dict) else entry.text for entry in transcript_list])
        
        # Handle long transcripts by chunking
        if len(transcript) > 1000:
            chunks = chunk_text(transcript, max_chunk_size=1000)
            summaries = []
            
            for chunk in chunks:
                try:
                    summary = summarizer(
                        chunk, 
                        max_length=130, 
                        min_length=30, 
                        do_sample=False,
                        truncation=True
                    )[0]["summary_text"]
                    summaries.append(summary)
                except Exception as sum_error:
                    print(f"Error summarizing chunk: {sum_error}")
                    continue
            
            # Combine chunk summaries
            final_summary = " ".join(summaries)
            
            # If combined summary is still long, summarize it again
            if len(final_summary) > 1000:
                final_summary = summarizer(
                    final_summary, 
                    max_length=150, 
                    min_length=50, 
                    do_sample=False,
                    truncation=True
                )[0]["summary_text"]
        else:
            # Direct summarization for shorter transcripts
            final_summary = summarizer(
                transcript, 
                max_length=150, 
                min_length=50, 
                do_sample=False,
                truncation=True
            )[0]["summary_text"]
        
        return {
            "video_id": video_id,
            "summary": final_summary,
            "transcript_length": len(transcript),
            "transcript": transcript[:2000] + "..." if len(transcript) > 2000 else transcript
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "False").lower() == "true"
    
    uvicorn.run(
        "main:app" if not debug else app, 
        host=host, 
        port=port, 
        reload=debug
    )