#!/bin/bash

set -e

echo "🚀 Bootstrapping MemoryDesk..."

mkdir -p backend
mkdir -p frontend

# =========================
# BACKEND
# =========================

cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install fastapi uvicorn[standard] pydantic python-dotenv sqlalchemy psycopg2-binary langgraph langchain langchain-groq

cat > requirements.txt <<'REQ'
fastapi
uvicorn[standard]
pydantic
python-dotenv
sqlalchemy
psycopg2-binary
langgraph
langchain
langchain-groq
REQ

cat > .env.example <<'ENV'
GROQ_API_KEY=
DATABASE_URL=postgresql://memorydesk:memorydesk@localhost:5432/memorydesk
ENV

cat > main.py <<'PY'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MemoryDesk Incident Response Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INCIDENTS = [
    {
        "id": "INC-0001",
        "title": "Payment API HTTP 500 errors",
        "service": "payment-api",
        "environment": "production",
        "severity": "SEV-2",
        "status": "resolved",
        "root_cause": "Database connection pool exhaustion",
        "resolution": "Increased connection pool from 10 to 50",
        "failed_actions": ["Restarted payment service — errors returned after 2 minutes"],
        "successful_actions": ["Increased connection pool 10 → 50"],
        "logs": [
            "14:02:11 ERROR payment-api HTTP 500",
            "14:02:13 ERROR database connection timeout",
            "14:02:15 WARN connection pool exhausted",
            "14:02:17 ERROR payment request failed"
        ]
    }
]

@app.get("/")
def root():
    return {"name": "MemoryDesk", "status": "online"}

@app.get("/api/incidents")
def incidents():
    return INCIDENTS

@app.get("/api/incidents/{incident_id}")
def incident(incident_id: str):
    for i in INCIDENTS:
        if i["id"] == incident_id:
            return i
    return {"error": "Incident not found"}

@app.post("/api/incidents")
def create_incident(data: dict):
    incident = {
        "id": f"INC-{len(INCIDENTS)+1:04d}",
        "title": data.get("title", "New Incident"),
        "service": data.get("service", "unknown"),
        "environment": data.get("environment", "production"),
        "severity": data.get("severity", "SEV-2"),
        "status": "investigating",
        "root_cause": None,
        "resolution": None,
        "failed_actions": [],
        "successful_actions": [],
        "logs": data.get("logs", [])
    }
    INCIDENTS.append(incident)
    return incident
PY

cd ..

# =========================
# FRONTEND
# =========================

npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --use-npm \
  --import-alias "@/*"

cd frontend

npm install lucide-react

cat > .env.local <<'ENV'
NEXT_PUBLIC_API_URL=http://localhost:8000
ENV

cd ..

echo ""
echo "======================================"
echo "✅ MemoryDesk bootstrap complete"
echo "======================================"
echo ""
echo "Backend:"
echo "  cd backend"
echo "  source .venv/bin/activate"
echo "  uvicorn main:app --reload"
echo ""
echo "Frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
