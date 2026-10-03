from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.incidents import router as incidents_router
from app.auth import router as auth_router

app = FastAPI(
    title="MemoryDesk",
    description="AI Software Incident Response Agent",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(incidents_router)

@app.get("/")
def root():
    return {
        "name": "MemoryDesk",
        "status": "online",
        "agent": "AI Software Incident Response Agent",
        "mode": "groq-llm-agent"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
