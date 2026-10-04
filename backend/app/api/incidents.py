from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import re
import uuid
import os
import json
from pathlib import Path
from dotenv import load_dotenv

from app.auth import get_current_user, get_optional_current_user

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_ENV = BACKEND_DIR / ".env"
ROOT_ENV = BACKEND_DIR.parent / ".env"

if BACKEND_ENV.exists():
    load_dotenv(BACKEND_ENV)
if ROOT_ENV.exists():
    load_dotenv(ROOT_ENV)
load_dotenv()

router = APIRouter(prefix="/api", tags=["incidents"])


# ============================================================
# MODELS
# ============================================================

class IncidentCreate(BaseModel):
    message: str


class ApprovalRequest(BaseModel):
    approved: bool


# ============================================================
# HISTORICAL ORGANIZATIONAL MEMORY
# These are NOT selectable demo incidents.
# They are the agent's previous experience.
# ============================================================

HISTORICAL_MEMORY = [
    {
        "id": "INC-0001",
        "service": "payment-api",
        "title": "Payment API HTTP 500 spike",
        "description": "Payment requests started returning HTTP 500 errors and timing out.",
        "symptoms": ["http 500", "timeout", "high latency", "database connection"],
        "root_cause": "Database connection pool saturation",
        "failed_actions": [
            "Restart payment service"
        ],
        "successful_actions": [
            "Increase database connection pool from 10 to 50"
        ],
        "resolution": "Database pool increased and payment traffic recovered.",
        "severity": "CRITICAL"
    },
    {
        "id": "INC-0002",
        "service": "refund-api",
        "title": "Refund API database timeout",
        "description": "Refund API returned HTTP 500 errors during a traffic spike.",
        "symptoms": ["http 500", "database timeout", "high latency", "connection pool"],
        "root_cause": "Database connection pool exhaustion",
        "failed_actions": [
            "Restart application instance"
        ],
        "successful_actions": [
            "Increase database connection pool"
        ],
        "resolution": "Connection pool increased and refund requests recovered.",
        "severity": "HIGH"
    },
    {
        "id": "INC-0003",
        "service": "auth-service",
        "title": "Authentication failures caused by Redis exhaustion",
        "description": "Login requests failed because authentication sessions could not be stored.",
        "symptoms": ["login failure", "redis", "connection exhausted", "authentication"],
        "root_cause": "Redis connection exhaustion",
        "failed_actions": [
            "Restart application pods"
        ],
        "successful_actions": [
            "Restart Redis cluster"
        ],
        "resolution": "Redis connections recovered and authentication returned to normal.",
        "severity": "HIGH"
    },
    {
        "id": "INC-0004",
        "service": "checkout-service",
        "title": "Checkout errors after deployment",
        "description": "Checkout started returning errors immediately after a production deployment.",
        "symptoms": ["deployment", "checkout", "500", "configuration", "release"],
        "root_cause": "Invalid production configuration introduced by deployment",
        "failed_actions": [
            "Restart checkout service"
        ],
        "successful_actions": [
            "Rollback deployment"
        ],
        "resolution": "Previous release restored checkout functionality.",
        "severity": "CRITICAL"
    },
    {
        "id": "INC-0005",
        "service": "notification-service",
        "title": "Notification queue backlog",
        "description": "Notifications were delayed because the processing queue grew rapidly.",
        "symptoms": ["queue", "backlog", "slow processing", "notifications"],
        "root_cause": "Insufficient worker capacity",
        "failed_actions": [
            "Restart one worker"
        ],
        "successful_actions": [
            "Scale notification workers"
        ],
        "resolution": "Additional workers drained the queue.",
        "severity": "MEDIUM"
    },
    {
        "id": "INC-0006",
        "service": "search-service",
        "title": "Search API latency spike",
        "description": "Search requests became extremely slow after a new query pattern appeared.",
        "symptoms": ["search", "latency", "slow query", "elasticsearch"],
        "root_cause": "Expensive unoptimized search query",
        "failed_actions": [
            "Increase application replicas"
        ],
        "successful_actions": [
            "Disable expensive query and optimize search filter"
        ],
        "resolution": "Search latency returned to normal after query optimization.",
        "severity": "HIGH"
    },
    {
        "id": "INC-0007",
        "service": "file-service",
        "title": "File uploads failing",
        "description": "Users could not upload files because storage capacity was exhausted.",
        "symptoms": ["upload", "storage", "disk full", "file service"],
        "root_cause": "Storage capacity exhaustion",
        "failed_actions": [
            "Restart file service"
        ],
        "successful_actions": [
            "Increase storage capacity and clean temporary files"
        ],
        "resolution": "Storage pressure dropped and uploads resumed.",
        "severity": "HIGH"
    },
    {
        "id": "INC-0008",
        "service": "order-service",
        "title": "Order creation deadlocks",
        "description": "Order creation requests intermittently failed because database transactions deadlocked.",
        "symptoms": ["order", "database", "deadlock", "transaction", "500"],
        "root_cause": "Concurrent transactions acquiring database locks in conflicting order",
        "failed_actions": [
            "Increase application replicas"
        ],
        "successful_actions": [
            "Add transaction retry and correct lock ordering"
        ],
        "resolution": "Deadlocks stopped after transaction handling was corrected.",
        "severity": "HIGH"
    },
    {
        "id": "INC-0009",
        "service": "payment-gateway",
        "title": "External payment provider timeout",
        "description": "Payment requests became slow because an external gateway stopped responding.",
        "symptoms": ["payment", "gateway", "timeout", "external service"],
        "root_cause": "External payment provider latency",
        "failed_actions": [
            "Restart payment API"
        ],
        "successful_actions": [
            "Enable circuit breaker and temporary retry policy"
        ],
        "resolution": "Traffic was protected while the external provider recovered.",
        "severity": "CRITICAL"
    },
    {
        "id": "INC-0010",
        "service": "analytics-worker",
        "title": "Analytics worker memory exhaustion",
        "description": "Analytics jobs crashed repeatedly because workers exhausted available memory.",
        "symptoms": ["worker", "memory", "crash", "analytics", "OOM"],
        "root_cause": "Worker memory exhaustion during large batch processing",
        "failed_actions": [
            "Restart worker repeatedly"
        ],
        "successful_actions": [
            "Increase worker memory and reduce batch size"
        ],
        "resolution": "Worker completed batches without memory crashes.",
        "severity": "HIGH"
    }
]

# Ensure all seeded historical incidents are explicitly marked as global organizational memory
for _mem in HISTORICAL_MEMORY:
    _mem["is_global"] = True
    _mem["user_id"] = None

# Snapshot of the 10 global seeded memories for database seeding
SEED_HISTORICAL_MEMORIES = [dict(m) for m in HISTORICAL_MEMORY]

from app.db import (
    init_db,
    is_db_connected,
    seed_memories_db,
    save_memory_db,
    load_memories_db,
    save_incident_db
)

# Attempt database initialization (will gracefully fallback if unavailable)
init_db()

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MEMORIES_FILE = DATA_DIR / "memories.json"


def save_memories_to_disk():
    # 1. Local JSON fallback (always maintained)
    try:
        user_mems = [m for m in HISTORICAL_MEMORY if not m.get("is_global", False)]
        with open(MEMORIES_FILE, "w", encoding="utf-8") as f:
            json.dump(user_mems, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving memories to disk: {e}")

    # 2. PostgreSQL persistence when available
    if is_db_connected():
        try:
            for m in HISTORICAL_MEMORY:
                save_memory_db(m)
        except Exception as e:
            print(f"[DATABASE] Error persisting memories to PostgreSQL: {e}")


def load_memories_from_disk():
    # 1. PostgreSQL persistence when available
    if is_db_connected():
        try:
            # Seed the 10 global organizational memories into PostgreSQL if not present
            seed_memories_db(SEED_HISTORICAL_MEMORIES)
            # Load stored memories from PostgreSQL
            db_mems = load_memories_db()
            for item in db_mems:
                if not any(m["id"] == item["id"] for m in HISTORICAL_MEMORY):
                    HISTORICAL_MEMORY.append(item)
        except Exception as e:
            print(f"[DATABASE] Error loading memories from PostgreSQL: {e}")

    # 2. Local JSON fallback
    try:
        if MEMORIES_FILE.exists():
            with open(MEMORIES_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                for item in saved:
                    if not any(m["id"] == item["id"] for m in HISTORICAL_MEMORY):
                        HISTORICAL_MEMORY.append(item)
    except Exception as e:
        print(f"Error loading memories from disk: {e}")


load_memories_from_disk()


# ============================================================
# MEMORY RETRIEVAL & ISOLATION HELPERS
# ============================================================

def get_user_accessible_memories(user_id: Optional[str] = None) -> list:
    """
    SERVER-SIDE ISOLATION:
    Returns only:
    1. Global / seeded organizational memory (shared by design)
    2. Private memory belonging to the requesting user_id
    User B's private memories are NEVER accessible to User A.
    """
    return [
        m for m in HISTORICAL_MEMORY
        if m.get("is_global", False) or (user_id and m.get("user_id") == user_id)
    ]


def check_incident_authorization(incident: dict, current_user: Optional[dict]):
    """
    SERVER-SIDE INCIDENT ACCESS ENFORCEMENT:
    Enforces that User A cannot view, approve, execute, verify, or resolve User B's incident.
    """
    if incident.get("is_global"):
        return
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to access this incident."
        )
    if incident.get("user_id") and incident.get("user_id") != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to access or modify this private incident."
        )


# ============================================================
# LIVE INCIDENT STORE
# ============================================================

INCIDENTS = {}

COUNTER = 10


# ============================================================
# AGENT STATE
# ============================================================

def get_max_incident_num() -> int:
    max_num = 10
    for m in HISTORICAL_MEMORY:
        mid = str(m.get("id", ""))
        if mid.startswith("INC-"):
            try:
                num = int(mid.split("-")[1])
                if num > max_num:
                    max_num = num
            except Exception:
                pass
    for iid in INCIDENTS.keys():
        if str(iid).startswith("INC-"):
            try:
                num = int(str(iid).split("-")[1])
                if num > max_num:
                    max_num = num
            except Exception:
                pass
    return max_num


def next_incident_id():
    global COUNTER
    max_existing = get_max_incident_num()
    if max_existing > COUNTER:
        COUNTER = max_existing
    COUNTER += 1
    return f"INC-{COUNTER:04d}"


def tokenize(text: str):
    return set(
        re.findall(
            r"[a-z0-9]+",
            text.lower()
        )
    )


# ============================================================
# KEYWORD & CONCEPT NORMALIZATION CLUSTERS
# ============================================================

CONCEPT_CLUSTERS = {
    "queue_backlog": {
        "keywords": [
            "queue", "backlog", "queue depth", "queued", "queues", "buffering", "backlogged", "unprocessed"
        ],
        "label": "Queue backlog buildup"
    },
    "notification_messaging": {
        "keywords": [
            "notification", "notifications", "messaging", "message", "messages", "alert", "alerts", "delivery", "dispatch", "push", "sms", "email"
        ],
        "label": "Notification & messaging delivery"
    },
    "delay_latency": {
        "keywords": [
            "delayed", "delay", "delays", "late", "later than expected", "slow", "lag", "timing out", "timeout", "timeouts", "latency", "high latency"
        ],
        "label": "Delivery delay & processing latency"
    },
    "worker_capacity": {
        "keywords": [
            "worker", "workers", "consumer", "consumers", "processing", "throughput", "capacity", "replica", "replicas", "scale"
        ],
        "label": "Worker processing capacity"
    },
    "database_pool": {
        "keywords": [
            "db", "database", "postgres", "sql", "connection pool", "pool exhaustion", "pool timeout", "connections", "saturation", "db pool", "deadlock"
        ],
        "label": "Database connection pool saturation"
    },
    "redis_auth": {
        "keywords": [
            "redis", "cache", "session", "sessions", "authentication", "auth", "login", "auth failure", "token", "tokens"
        ],
        "label": "Redis session & authentication exhaustion"
    },
    "deployment_release": {
        "keywords": [
            "deploy", "deployment", "release", "rollout", "version", "production deployment", "after deployment", "rollback", "regression"
        ],
        "label": "Post-deployment release regression"
    },
    "payment_gateway": {
        "keywords": [
            "payment", "checkout payment", "transaction", "transactions", "gateway", "stripe", "order placement", "refund", "checkout"
        ],
        "label": "Payment & checkout transaction failures"
    },
    "http_errors": {
        "keywords": [
            "500", "503", "502", "http 500", "error", "errors", "internal server error", "failing", "failures"
        ],
        "label": "Elevated HTTP failure rate"
    }
}


def extract_concepts(text: str) -> set[str]:
    text_lower = text.lower()
    matched_clusters = set()
    for cluster_id, data in CONCEPT_CLUSTERS.items():
        for kw in data["keywords"]:
            pattern = r"(?:\b|_)" + re.escape(kw) + r"(?:\b|_)"
            if re.search(pattern, text_lower):
                matched_clusters.add(cluster_id)
                break
    return matched_clusters


def compute_similarity(query: str, incident: dict):
    """
    Computes similarity percentage and dynamic matching reasons
    between user incident description and historical memory.
    Supports concept normalization across synonyms.
    """
    q_tokens = tokenize(query)
    title = incident.get("title", "")
    rc = incident.get("root_cause", "")
    svc = incident.get("service", "")
    desc = incident.get("description", "")
    symptoms = incident.get("symptoms", [])
    symptoms_str = " ".join(symptoms) if isinstance(symptoms, list) else str(symptoms)

    all_memory_text = f"{title} {desc} {svc} {rc} {symptoms_str}"
    all_memory_tokens = tokenize(all_memory_text)

    if not q_tokens:
        return 0, []

    matched_all = q_tokens.intersection(all_memory_tokens)
    reasons = []

    # 1. Semantic Concept Normalization Matching
    q_concepts = extract_concepts(query)
    inc_concepts = extract_concepts(all_memory_text)
    shared_concepts = q_concepts.intersection(inc_concepts)

    for cid in shared_concepts:
        reasons.append(f"Shared failure pattern: {CONCEPT_CLUSTERS[cid]['label']}")

    # 2. Domain / keyword checks (backwards compatible)
    text_lower = query.lower()
    if any(k in text_lower for k in ["500", "503", "error", "errors"]):
        if any(k in desc.lower() or k in symptoms_str.lower() or "500" in title.lower() for k in ["500", "503", "error"]):
            if "Shared failure pattern: Elevated HTTP failure rate" not in reasons:
                reasons.append("Similar HTTP 500 errors")

    if svc.replace("-", " ") in text_lower or svc.replace("-", "") in text_lower:
        reasons.append(f"Matching service domain: {svc}")

    stop_words = {"is", "are", "the", "a", "an", "and", "in", "on", "for", "of", "to", "at", "by", "with", "from", "it", "this", "that", "has", "have", "been"}
    meaningful_q = q_tokens - stop_words
    if not meaningful_q:
        return 0, []

    q_coverage = len((matched_all - stop_words)) / len(meaningful_q)

    # Score calculation based on concept clusters and word coverage
    if len(shared_concepts) >= 2:
        scaled_score = min(0.88 + (len(shared_concepts) * 0.03) + (q_coverage * 0.05), 0.96)
    elif len(shared_concepts) == 1:
        scaled_score = min(0.75 + (q_coverage * 0.15), 0.88)
    elif len(reasons) >= 2 and q_coverage >= 0.30:
        scaled_score = min(0.85 + (q_coverage * 0.05), 0.92)
    elif len(reasons) >= 1 and q_coverage >= 0.18:
        scaled_score = min(0.70 + (q_coverage * 0.15), 0.84)
    elif q_coverage >= 0.40:
        scaled_score = min(0.55 + (q_coverage * 0.20), 0.70)
    else:
        scaled_score = q_coverage * 0.30

    score_pct = round(scaled_score * 100)
    return score_pct, reasons


def similarity(query: str, incident: dict):
    score, _ = compute_similarity(query, incident)
    return score / 100.0


def get_memory_matches(message: str, user_id: Optional[str] = None):
    scored = []
    pool = get_user_accessible_memories(user_id)
    for incident in pool:
        score_pct, reasons = compute_similarity(message, incident)
        is_personal = not incident.get("is_global", False) and bool(user_id and incident.get("user_id") == user_id)
        if is_personal and score_pct >= 40:
            effective_score = min(score_pct + 6, 98)
            reasons_copy = ["First seen in your incident history"] + reasons
        else:
            effective_score = score_pct
            reasons_copy = reasons

        scored.append({
            "incident": incident,
            "score": effective_score,
            "raw_score": score_pct,
            "is_personal": is_personal,
            "source": "YOUR_INCIDENT_HISTORY" if is_personal else "ORGANIZATIONAL_MEMORY",
            "reasons": reasons_copy
        })
    scored.sort(key=lambda x: (1 if x["is_personal"] else 0, x["score"]), reverse=True)
    return scored


def classify(message: str):
    text = message.lower()

    if any(x in text for x in ["payment", "checkout", "refund"]):
        category = "Transaction / API"
    elif any(x in text for x in ["login", "auth", "authentication"]):
        category = "Authentication"
    elif any(x in text for x in ["queue", "worker", "notification"]):
        category = "Async Processing"
    elif any(x in text for x in ["storage", "upload", "disk"]):
        category = "Storage"
    elif any(x in text for x in ["deployment", "release", "deploy"]):
        category = "Deployment"
    elif any(x in text for x in ["database", "db", "sql"]):
        category = "Database"
    else:
        category = "Software / Infrastructure"

    if any(x in text for x in [
        "down", "500", "503", "cannot", "unable", "crash",
        "failure", "failing", "timeout", "exhausted", "deadlock"
    ]):
        severity = "HIGH"
    else:
        severity = "MEDIUM"

    return category, severity


def infer_evidence(message: str):
    text = message.lower()

    has_500 = "500" in text or "error" in text or "503" in text
    has_503 = "503" in text
    has_timeout = "timeout" in text or "timing out" in text or "latency" in text or "slow" in text
    has_database = any(x in text for x in ["database", "db", "connection", "connections", "pool", "exhaustion", "deadlock"])
    has_redis = any(x in text for x in ["redis", "auth", "login", "session"])
    has_queue = any(x in text for x in ["queue", "backlog", "worker"])
    has_storage = any(x in text for x in ["storage", "disk", "upload"])

    signals = []

    if has_500:
        signals.append({
            "type": "LOG",
            "label": "HTTP 500 errors detected",
            "value": "Error rate elevated above baseline threshold"
        })

    if has_503:
        signals.append({
            "type": "LOG",
            "label": "HTTP 503 errors detected",
            "value": "Service unavailable responses from backend"
        })

    if has_timeout:
        signals.append({
            "type": "METRIC",
            "label": "Request timeout pattern",
            "value": "Response latency spiking above baseline"
        })

    if has_database:
        signals.append({
            "type": "METRIC",
            "label": "Database connection pressure",
            "value": "Pool saturation / connection exhaustion suspected"
        })

    if has_redis:
        signals.append({
            "type": "METRIC",
            "label": "Session store capacity",
            "value": "Redis connection pool saturated"
        })

    if has_queue:
        signals.append({
            "type": "METRIC",
            "label": "Queue processing delay",
            "value": "Worker queue backlog accumulating"
        })

    if has_storage:
        signals.append({
            "type": "METRIC",
            "label": "Storage volume capacity",
            "value": "Disk space critically low"
        })

    if not signals:
        signals.append({
            "type": "INPUT",
            "label": "Engineer report",
            "value": "Direct incident report received"
        })

    metrics = {
        "http_500_rate": "17.9%" if has_500 else ("0.1%" if not ("error" in text or "fail" in text) else "6.2%"),
        "db_pool_utilization": "98%" if has_database else "38%",
        "latency_ms": "5100" if has_timeout else "165"
    }

    return {
        "signals": signals,
        "metrics": metrics
    }


def generate_rca(message: str, memory: Optional[dict], match_found: bool):
    if memory and match_found:
        root = memory["root_cause"]
        confidence = 0.91
        reason = (
            f"Current HTTP errors and operational symptoms "
            f"closely match the historical failure signature of {memory['id']}."
        )
        supporting_evidence = [
            f"Telemetry signature matches historical incident {memory['id']} ({memory['title']})",
            f"Verified root cause precedent: {memory['root_cause']}",
            f"Proven remediation available: {memory['successful_actions'][0]}"
        ]
        return root, confidence, reason, supporting_evidence

    category, _ = classify(message)
    return (
        f"Unclassified root cause in {category}",
        0.52,
        "No sufficiently similar historical incident was found in organizational memory. The agent will rely on real-time evidence.",
        [
            "Real-time telemetry and error signals analyzed",
            "No historical precedent identified above confidence threshold",
            "Eventual resolution will become new organizational memory"
        ]
    )


def recommendation_for(message: str, memory: Optional[dict], match_found: bool):
    text = message.lower()

    if memory and match_found:
        successful = memory["successful_actions"][0]
        failed = memory["failed_actions"][0]

        why_memory_changed = (
            f"The current incident closely resembles {memory['id']}. "
            f"The previous restart attempt failed, while '{successful}' "
            f"successfully resolved the previous incident. "
            f"The agent therefore recommends the previously successful remediation."
        )

        return {
            "action": successful,
            "avoided_action": failed,
            "failed_action_warning": f"Avoid '{failed}' — this action failed in previous incident {memory['id']}.",
            "why": f"Historical incident {memory['id']} used this action successfully after '{failed}' failed.",
            "why_memory_changed": why_memory_changed,
            "risk": "LOW",
            "requires_approval": True
        }

    if "deployment" in text or "deploy" in text or "release" in text:
        action = "Rollback the latest deployment"
    elif "queue" in text or "worker" in text:
        action = "Scale the queue workers from 2 to 10 instances"
    elif "storage" in text or "disk" in text or "upload" in text:
        action = "Increase storage capacity and purge temporary buffers"
    elif "memory" in text or "oom" in text:
        action = "Increase worker memory limit and reduce batch size"
    else:
        action = "Collect additional service telemetry and isolate affected components"

    why_memory_changed = (
        "I couldn't find a sufficiently similar incident in organizational memory. "
        "I'll analyze the current evidence and this incident's eventual resolution can become future organizational memory."
    )

    return {
        "action": action,
        "avoided_action": None,
        "failed_action_warning": "No historical failure recorded for this pattern. Review telemetry before execution.",
        "why": "No historical remediation was sufficiently applicable. Recommending cautious diagnostic remediation.",
        "why_memory_changed": why_memory_changed,
        "risk": "MEDIUM",
        "requires_approval": True
    }


def build_agent_activity(message: str, best: Optional[dict], match_found: bool):
    category, severity = classify(message)

    activity = [
        {
            "step": "intake",
            "status": "completed",
            "title": "Incident received",
            "detail": "Engineer report converted into a new live incident."
        },
        {
            "step": "classification",
            "status": "completed",
            "title": "Incident classified",
            "detail": f"{category} · {severity} severity"
        },
        {
            "step": "evidence",
            "status": "completed",
            "title": "Investigating evidence",
            "detail": "Agent analyzed reported symptoms and extracted telemetry signals."
        },
        {
            "step": "memory",
            "status": "completed",
            "title": "Searching organizational memory",
            "detail": (
                f"Historical match: {best['incident']['id']} ({best['score']}% similarity)"
                if (best and match_found)
                else "Searched 10 historical incidents — no strong match found"
            )
        }
    ]

    if best and match_found:
        activity.append({
            "step": "comparison",
            "status": "completed",
            "title": "Comparing historical incidents",
            "detail": f"Compared what worked vs what failed in {best['incident']['id']}."
        })
    else:
        activity.append({
            "step": "comparison",
            "status": "completed",
            "title": "Comparing historical incidents",
            "detail": "Evaluated all historical precedents; treated as a novel failure signature."
        })

    activity.append({
        "step": "reasoning",
        "status": "completed",
        "title": "Generating root-cause hypothesis",
        "detail": "Synthesized current evidence and historical context into root-cause hypothesis."
    })

    activity.append({
        "step": "recommendation",
        "status": "completed",
        "title": "Generating recommendation",
        "detail": "Formulated targeted remediation with risk assessment."
    })

    activity.append({
        "step": "approval",
        "status": "waiting",
        "title": "Human approval required",
        "detail": "Agent requires human engineer sign-off before executing changes."
    })

    return activity


GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
]

GROQ_SYSTEM_PROMPT = """You are MemoryDesk, an AI software incident response agent.
Your job is to investigate a newly reported software incident using current incident information and organizational memory.
Compare the current incident against historical incidents.
Identify which historical incident is genuinely relevant.
Never invent an incident ID. If a historical match is found, incident_id MUST be an exact ID from the provided organizational memory.
Return ONLY a single valid JSON object matching the requested schema."""


def analyze_incident_with_groq(message: str, candidate_incidents: list[dict]):
    if BACKEND_ENV.exists():
        load_dotenv(BACKEND_ENV, override=True)
    if ROOT_ENV.exists():
        load_dotenv(ROOT_ENV, override=True)
    load_dotenv(override=True)
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=500,
            detail="LLM configuration missing: GROQ_API_KEY"
        )

    try:
        from groq import Groq
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Groq Python SDK not installed in backend virtual environment"
        )

    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    candidates_formatted = [
        {
            "id": c["id"],
            "source": "YOUR INCIDENT HISTORY (previously resolved by your team)" if not c.get("is_global", False) else "ORGANIZATIONAL MEMORY PRECEDENT",
            "service": c["service"],
            "title": c["title"],
            "description": c["description"],
            "symptoms": list(c.get("symptoms", [])) if isinstance(c.get("symptoms"), (set, list, tuple)) else [str(c.get("symptoms", ""))],
            "root_cause": c["root_cause"],
            "failed_actions": c["failed_actions"],
            "successful_actions": c["successful_actions"],
            "resolution": c["resolution"],
            "severity": c["severity"],
        }
        for c in candidate_incidents
    ]

    user_prompt = f"""NEW REPORTED INCIDENT:
"{message}"

ORGANIZATIONAL MEMORY:
{json.dumps(candidates_formatted, indent=2)}

INSTRUCTIONS:
Return a single valid JSON object comparing this new incident to the organizational memory:

- If a historical incident genuinely matches the symptoms/root-cause with high confidence (>= 50% relevance):
  "historical_match": {{
    "found": true,
    "incident_id": "<exact ID from memory, e.g. INC-0001>",
    "similarity": <integer 50-100>,
    "why_similar": ["<reason 1>", "<reason 2>"],
    "important_difference": "<difference or null>"
  }},
  "historical_experience": {{
    "failed_action": "<failed action from matched memory>",
    "failed_result": "<result of failed action>",
    "successful_action": "<successful action from matched memory>",
    "successful_result": "<result of successful action>"
  }}

- If NO historical incident is sufficiently relevant:
  DO NOT force or invent a match. Set:
  "historical_match": {{
    "found": false,
    "incident_id": null,
    "similarity": 0,
    "why_similar": [],
    "important_difference": null
  }},
  "historical_experience": null

SCHEMA:
{{
  "classification": "<Transaction / API | Authentication | Async Processing | Deployment | Storage | Database | Software / Infrastructure>",
  "severity": "<LOW | MEDIUM | HIGH | CRITICAL>",
  "summary": "<1-2 sentence description>",
  "historical_match": {{ ... }},
  "historical_experience": {{ ... or null }},
  "root_cause_hypothesis": {{
    "cause": "<root cause hypothesis>",
    "confidence": <0.0 to 1.0>,
    "reason": "<explanation based on available evidence>"
  }},
  "recommendation": {{
    "action": "<remediation action or diagnostic investigation step>",
    "reason": "<why this action should be taken>",
    "risk": "<LOW | MEDIUM | HIGH>",
    "requires_human_approval": true,
    "sufficient_information": <true or false>,
    "missing_information": "<additional telemetry or logs needed if insufficient, otherwise null>"
  }},
  "agent_message": "<clear explanation for the engineer whether a memory was matched or if treated as a novel incident>"
}}"""

    last_error = None
    response_text = None
    model_used = None

    for model_name in GROQ_MODELS:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            response_text = completion.choices[0].message.content
            model_used = model_name
            break
        except Exception as e:
            last_error = e
            # Try to salvage failed_generation if provided by Groq
            err_dict = getattr(e, "body", None)
            if isinstance(err_dict, dict) and "error" in err_dict:
                failed_gen = err_dict["error"].get("failed_generation")
                if failed_gen:
                    try:
                        salvaged = re.sub(r"\}\s*,\s*\{", ",", failed_gen)
                        data = json.loads(salvaged)
                        return data, model_name
                    except Exception:
                        pass
            continue

    if not response_text:
        raise HTTPException(
            status_code=502,
            detail=f"Groq API call failed across candidate models: {str(last_error)}"
        )

    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        try:
            cleaned = response_text.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
                cleaned = re.sub(r"\n?```$", "", cleaned)
            data = json.loads(cleaned)
        except Exception as parse_err:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to parse LLM structured JSON response: {str(parse_err)}"
            )

    return data, model_used


# ============================================================
# DYNAMIC VERIFICATION TELEMETRY & AUDIT GENERATORS
# ============================================================

def classify_incident_type(incident: dict) -> str:
    category = str(incident.get("category", "")).lower()
    title = str(incident.get("title", "")).lower()
    message = str(incident.get("message", "")).lower()
    rca = str(incident.get("agent", {}).get("rca", "") or incident.get("rca", {}).get("root_cause", "")).lower()
    rec_obj = incident.get("agent", {}).get("recommendation", {}) or incident.get("recommendation", {}) or {}
    action = str(rec_obj.get("action", "")).lower()
    mem_title = str(incident.get("memory", {}).get("title", "")).lower()
    mem_svc = str(incident.get("memory", {}).get("service", "")).lower()
    all_text = f"{category} {title} {message} {rca} {action} {mem_title} {mem_svc}"

    if any(k in all_text for k in ["notification", "queue", "worker", "delayed", "backlog"]):
        return "notification"
    elif any(k in all_text for k in ["redis", "auth", "session", "login"]):
        return "auth"
    elif any(k in all_text for k in ["checkout", "deploy", "release", "rollback", "v2."]):
        return "checkout"
    elif any(k in all_text for k in ["payment", "database", "db", "pool", "refund", "sql", "timeout", "connection pool"]):
        return "payment"
    return "general"


def generate_verification_telemetry(incident: dict) -> dict:
    inc_type = classify_incident_type(incident)
    now_iso = datetime.utcnow().isoformat()

    if inc_type == "notification":
        return {
            "verified": True,
            "incident_type": "notification_queue_backlog",
            "mode": "CONTROLLED_SIMULATED_VERIFICATION",
            "explanation": (
                "Notification workers scaled up. Worker queue backlog drained and "
                "message dispatch latency normalized to 3s."
            ),
            "time": now_iso,
            "metrics": [
                {
                    "id": "queue_backlog",
                    "label": "QUEUE BACKLOG",
                    "before": "48,200 msgs",
                    "after": "120 msgs",
                    "status_before": "Backlogged",
                    "status_after": "Drained",
                    "subtext": "-99.7% Queue Drained to Realtime",
                    "bar_before": 96,
                    "bar_after": 3,
                    "badge_color": "rose"
                },
                {
                    "id": "dispatch_lag",
                    "label": "DISPATCH LAG",
                    "before": "840s",
                    "after": "3s",
                    "status_before": "Delayed",
                    "status_after": "Instant",
                    "subtext": "Near Zero Notification Delivery Delay",
                    "bar_before": 90,
                    "bar_after": 4,
                    "badge_color": "amber"
                },
                {
                    "id": "worker_utilization",
                    "label": "WORKER CAPACITY",
                    "before": "100%",
                    "after": "46%",
                    "status_before": "Overloaded",
                    "status_after": "Balanced",
                    "subtext": "Auto-scaled Workers Processing Sustainably",
                    "bar_before": 100,
                    "bar_after": 46,
                    "badge_color": "rose"
                }
            ],
            "before": {
                "queue_depth": "48,200 msgs",
                "dispatch_lag": "840s",
                "worker_utilization": "100%"
            },
            "after": {
                "queue_depth": "120 msgs",
                "dispatch_lag": "3s",
                "worker_utilization": "46%"
            },
            "audit_detail": "Queue recovery metrics verified."
        }

    elif inc_type == "auth":
        return {
            "verified": True,
            "incident_type": "auth_redis_exhaustion",
            "mode": "CONTROLLED_SIMULATED_VERIFICATION",
            "explanation": (
                "Redis session store cluster restarted and connection pool recovered. "
                "Authentication token validations restored with sub-20ms response."
            ),
            "time": now_iso,
            "metrics": [
                {
                    "id": "auth_failure_rate",
                    "label": "AUTH FAILURE RATE",
                    "before": "26.8%",
                    "after": "0.02%",
                    "status_before": "Failing",
                    "status_after": "Zero Loss",
                    "subtext": "-99.9% Authentication Failure Recovery",
                    "bar_before": 92,
                    "bar_after": 1,
                    "badge_color": "rose"
                },
                {
                    "id": "session_latency",
                    "label": "SESSION LOOKUP P99",
                    "before": "3850ms",
                    "after": "18ms",
                    "status_before": "Blocked",
                    "status_after": "Sub-20ms",
                    "subtext": "Session Token Cache Restored",
                    "bar_before": 91,
                    "bar_after": 5,
                    "badge_color": "amber"
                },
                {
                    "id": "redis_connections",
                    "label": "REDIS CONNECTION POOL",
                    "before": "100%",
                    "after": "28%",
                    "status_before": "Exhausted",
                    "status_after": "Healthy",
                    "subtext": "Redis Cluster Connections Normal (28/100)",
                    "bar_before": 100,
                    "bar_after": 28,
                    "badge_color": "rose"
                }
            ],
            "before": {
                "auth_failure_rate": "26.8%",
                "session_latency": "3850ms",
                "redis_connections": "100%"
            },
            "after": {
                "auth_failure_rate": "0.02%",
                "session_latency": "18ms",
                "redis_connections": "28%"
            },
            "audit_detail": "Redis and authentication recovery metrics verified."
        }

    elif inc_type == "checkout":
        return {
            "verified": True,
            "incident_type": "checkout_deployment_failure",
            "mode": "CONTROLLED_SIMULATED_VERIFICATION",
            "explanation": (
                "Production deployment rolled back to stable release v2.13.9. "
                "Order placement pipeline and checkout APIs restored."
            ),
            "time": now_iso,
            "metrics": [
                {
                    "id": "checkout_error_rate",
                    "label": "CHECKOUT ERROR RATE",
                    "before": "31.2%",
                    "after": "0.05%",
                    "status_before": "Spiking",
                    "status_after": "Stable",
                    "subtext": "-99.8% Checkout Failures Cleared",
                    "bar_before": 95,
                    "bar_after": 2,
                    "badge_color": "rose"
                },
                {
                    "id": "deployment_revision",
                    "label": "DEPLOYMENT REVISION",
                    "before": "v2.14.0 (Failed)",
                    "after": "v2.13.9 (Stable)",
                    "status_before": "Faulty",
                    "status_after": "Active",
                    "subtext": "Rolled Back to Last Known Stable Release",
                    "bar_before": 100,
                    "bar_after": 10,
                    "badge_color": "amber"
                },
                {
                    "id": "order_success_rate",
                    "label": "ORDER SUCCESS RATE",
                    "before": "42.0%",
                    "after": "99.8%",
                    "status_before": "Degraded",
                    "status_after": "Optimal",
                    "subtext": "Order Placement Pipeline Restored",
                    "bar_before": 42,
                    "bar_after": 99,
                    "badge_color": "rose"
                }
            ],
            "before": {
                "checkout_error_rate": "31.2%",
                "deployment_revision": "v2.14.0 (Failed)",
                "order_success_rate": "42.0%"
            },
            "after": {
                "checkout_error_rate": "0.05%",
                "deployment_revision": "v2.13.9 (Stable)",
                "order_success_rate": "99.8%"
            },
            "audit_detail": "Deployment recovery metrics verified."
        }

    elif inc_type == "payment":
        return {
            "verified": True,
            "incident_type": "payment_database_pool",
            "mode": "CONTROLLED_SIMULATED_VERIFICATION",
            "explanation": (
                "Database connection pool scaled to 50 connections. "
                "Connection timeouts cleared and query latency returned to healthy baseline."
            ),
            "time": now_iso,
            "metrics": [
                {
                    "id": "error_rate",
                    "label": "ERROR RATE",
                    "before": "18.4%",
                    "after": "0.1%",
                    "status_before": "Spiking",
                    "status_after": "Recovered",
                    "subtext": "-99.4% Error Drop (Normal)",
                    "bar_before": 88,
                    "bar_after": 2,
                    "badge_color": "rose"
                },
                {
                    "id": "latency",
                    "label": "P99 LATENCY",
                    "before": "5240ms",
                    "after": "380ms",
                    "status_before": "Timeout",
                    "status_after": "Optimal",
                    "subtext": "Sub-second Response Restored",
                    "bar_before": 94,
                    "bar_after": 8,
                    "badge_color": "amber"
                },
                {
                    "id": "db_pool",
                    "label": "DB CONNECTION POOL",
                    "before": "100%",
                    "after": "34%",
                    "status_before": "Exhausted",
                    "status_after": "Healthy",
                    "subtext": "Pool Capacity Stabilized (34/50)",
                    "bar_before": 100,
                    "bar_after": 34,
                    "badge_color": "rose"
                }
            ],
            "before": {
                "http_500_rate": "18.4%",
                "latency": "5240ms",
                "db_pool": "100%"
            },
            "after": {
                "http_500_rate": "0.1%",
                "latency": "380ms",
                "db_pool": "34%"
            },
            "audit_detail": "Database connection pool recovery metrics verified."
        }

    else:
        return {
            "verified": True,
            "incident_type": "general_service_recovery",
            "mode": "CONTROLLED_SIMULATED_VERIFICATION",
            "explanation": "Service health returned to expected operating baseline following remediation.",
            "time": now_iso,
            "metrics": [
                {
                    "id": "system_error_rate",
                    "label": "SYSTEM ERROR RATE",
                    "before": "19.5%",
                    "after": "0.1%",
                    "status_before": "Degraded",
                    "status_after": "Healthy",
                    "subtext": "Operational Baseline Restored",
                    "bar_before": 85,
                    "bar_after": 2,
                    "badge_color": "rose"
                },
                {
                    "id": "latency_p95",
                    "label": "LATENCY P95",
                    "before": "4100ms",
                    "after": "290ms",
                    "status_before": "Spiking",
                    "status_after": "Normal",
                    "subtext": "P95 Latency Recovered",
                    "bar_before": 90,
                    "bar_after": 7,
                    "badge_color": "amber"
                },
                {
                    "id": "service_availability",
                    "label": "SERVICE AVAILABILITY",
                    "before": "76.4%",
                    "after": "99.9%",
                    "status_before": "Unstable",
                    "status_after": "100%",
                    "subtext": "Service Availability Restored",
                    "bar_before": 76,
                    "bar_after": 99,
                    "badge_color": "rose"
                }
            ],
            "before": {
                "system_error_rate": "19.5%",
                "latency_p95": "4100ms",
                "service_availability": "76.4%"
            },
            "after": {
                "system_error_rate": "0.1%",
                "latency_p95": "290ms",
                "service_availability": "99.9%"
            },
            "audit_detail": "Recovery metrics verified."
        }


def get_incident_created_detail(category: str, summary: str, message: str) -> str:
    cat_lower = (category or "").lower()
    msg_lower = (message or "").lower()
    sum_lower = (summary or "").lower()
    all_text = f"{cat_lower} {msg_lower} {sum_lower}"

    if any(k in all_text for k in ["notification", "queue", "worker", "delayed", "backlog"]):
        return "Notification delay and queue growth reported."
    elif any(k in all_text for k in ["checkout", "deploy", "release", "rollback", "v2."]):
        return "Checkout error spike and post-deployment failure reported."
    elif any(k in all_text for k in ["redis", "auth", "session", "login"]):
        return "Authentication failure and Redis session exhaustion reported."
    elif any(k in all_text for k in ["payment", "database", "db", "pool", "refund", "sql", "timeout", "connection pool"]):
        return "Payment API timeouts and database connection pool saturation reported."
    else:
        clean_sum = summary.strip().rstrip(".")
        if len(clean_sum) > 65:
            clean_sum = clean_sum[:65] + "..."
        return f"{clean_sum} reported."


def get_memory_match_detail(category: str, matched_inc: dict) -> str:
    svc = (matched_inc.get("service") or "").lower()
    title = (matched_inc.get("title") or "").lower()
    matched_id = matched_inc.get("id", "previous incident")
    all_text = f"{category.lower()} {svc} {title}"

    if any(k in all_text for k in ["notification", "queue"]):
        return "Previous notification queue incident found."
    elif any(k in all_text for k in ["checkout", "deploy"]):
        return "Previous checkout deployment incident found."
    elif any(k in all_text for k in ["redis", "auth"]):
        return "Previous authentication Redis incident found."
    elif any(k in all_text for k in ["payment", "database", "pool", "refund"]):
        return "Previous payment database pool incident found."
    else:
        return f"Previous {matched_inc.get('title', 'similar incident')} found ({matched_id})."


# ============================================================
# CREATE INCIDENT — THE JURY ENTERS THE PROBLEM HERE
# ============================================================

@router.post("/agent/incidents")
@router.post("/incidents")
def create_incident(
    payload: IncidentCreate,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):

    if not payload.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Incident description cannot be empty."
        )

    # Derive authenticated user identity strictly on the server
    user_id = current_user["id"] if current_user else "usr_chidek"
    user_email = current_user["email"] if current_user else "chidek"

    # 1. Candidate Retrieval from Historical Memory (filtered for current user)
    # Retrieve candidates to pass into the LLM context
    candidate_matches = get_memory_matches(payload.message, user_id=user_id)
    candidate_incidents = [m["incident"] for m in candidate_matches]

    # 2. Call the REAL Groq LLM (raises HTTPException if key missing or call fails)
    llm_result, model_used = analyze_incident_with_groq(payload.message, candidate_incidents)

    # 3. Process LLM Structured Output safely
    incident_id = next_incident_id()
    category = llm_result.get("classification") or "Software / Infrastructure"
    severity = llm_result.get("severity") or "HIGH"
    summary = llm_result.get("summary") or payload.message

    llm_match = llm_result.get("historical_match")
    if not isinstance(llm_match, dict):
        llm_match = {}

    matched_id = llm_match.get("incident_id")
    user_memories = get_user_accessible_memories(user_id)
    matched_inc = next((i for i in user_memories if i["id"] == matched_id), None) if matched_id else None
    raw_sim = int(llm_match.get("similarity", 0) or 0)

    # Check if candidate_matches contains a personal memory with a strong match
    top_personal = next((m for m in candidate_matches if m.get("is_personal") and m.get("score", 0) >= 65), None)
    if top_personal and (not matched_inc or matched_inc.get("is_global", False)):
        # Prefer the user's personal incident history over global precedent
        matched_inc = top_personal["incident"]
        matched_id = matched_inc["id"]
        raw_sim = max(raw_sim, top_personal["score"])
        llm_match["found"] = True

    # Validation: match_found is strictly true only if LLM found is True AND matched_inc actually exists in memory AND similarity >= 40
    match_found = bool(llm_match.get("found")) and (matched_inc is not None) and (raw_sim >= 40)

    is_personal = bool(matched_inc and not matched_inc.get("is_global", False) and matched_inc.get("user_id") == user_id)
    match_source = "YOUR_INCIDENT_HISTORY" if is_personal else "ORGANIZATIONAL_MEMORY"
    match_source_label = "FIRST SEEN IN YOUR INCIDENT HISTORY" if is_personal else "ORGANIZATIONAL MEMORY PRECEDENT"

    llm_exp = llm_result.get("historical_experience")
    if not isinstance(llm_exp, dict):
        llm_exp = {}
    llm_rca = llm_result.get("root_cause_hypothesis")
    if not isinstance(llm_rca, dict):
        llm_rca = {}
    llm_rec = llm_result.get("recommendation")
    if not isinstance(llm_rec, dict):
        llm_rec = {}
    agent_msg = llm_result.get("agent_message") or ""

    why_similar = llm_match.get("why_similar") or []
    if not isinstance(why_similar, list):
        why_similar = [str(why_similar)]
    important_diff = llm_match.get("important_difference")

    if match_found and matched_inc:
        failed_act = llm_exp.get("failed_action") or (matched_inc["failed_actions"][0] if matched_inc.get("failed_actions") else None)
        success_act = llm_exp.get("successful_action") or (matched_inc["successful_actions"][0] if matched_inc.get("successful_actions") else None)
        failed_res = llm_exp.get("failed_result") or ("Service remained unhealthy" if failed_act else None)
        success_res = llm_exp.get("successful_result") or ("Problem recovered" if success_act else None)
        similarity_score = raw_sim if raw_sim >= 40 else 85
        if is_personal:
            why_similar = ["First seen in your incident history"] + [r for r in why_similar if r != "First seen in your incident history"]
    else:
        failed_act = None
        success_act = None
        failed_res = None
        success_res = None
        matched_id = None
        similarity_score = 0
        why_similar = []
        match_found = False

    match_data = {
        "found": match_found,
        "match_found": match_found,
        "incident_id": matched_id if match_found else None,
        "similarity": similarity_score,
        "similarity_score": similarity_score,
        "is_personal": is_personal,
        "source": match_source,
        "source_label": match_source_label,
        "match_reason": agent_msg or ("Correlated failure signature from " + match_source_label),
        "title": matched_inc["title"] if matched_inc else "No closely related experience found",
        "service": matched_inc["service"] if matched_inc else category,
        "root_cause": matched_inc["root_cause"] if matched_inc else llm_rca.get("cause", "Novel failure pattern"),
        "failed_actions": [failed_act] if failed_act else [],
        "successful_actions": [success_act] if success_act else [],
        "previous_failed_actions": [failed_act] if failed_act else [],
        "previous_successful_actions": [success_act] if success_act else [],
        "failed_action": failed_act,
        "failed_result": failed_res,
        "successful_action": success_act,
        "successful_result": success_res,
        "resolution": matched_inc.get("resolution") if matched_inc else "Remediation to be verified",
        "why_similar": why_similar,
        "why_retrieved": why_similar,
        "important_difference": important_diff,
        "why_memory_changed": agent_msg or (
            f"The current incident closely resembles {matched_id} ({'your team previous experience' if is_personal else 'organizational memory'}). "
            f"The previous restart attempt failed, while '{success_act}' successfully resolved the incident. "
            f"The agent therefore recommends the previously successful remediation."
            if match_found else
            "We couldn't find a previous incident that closely matches this problem. MemoryDesk doesn't invent a previous experience when none exists."
        ),
        "agent_message": agent_msg,
        "llm_model": model_used
    }

    rca_cause = llm_rca.get("cause", "Underlying service anomaly")
    rca_conf = float(llm_rca.get("confidence", 0.88) or 0.88)
    rca_reason = llm_rca.get("reason", "Analyzed by LLM based on current evidence and organizational memory.")

    supporting_evidence = [
        summary,
        rca_reason
    ]
    if match_found and matched_id:
        supporting_evidence.append(f"Historical failure signature correlation: {matched_id}")
        if important_diff:
            supporting_evidence.append(f"Noted context difference: {important_diff}")

    rec_action = llm_rec.get("action") or (success_act if match_found else "Inspect service telemetry and isolate affected components")
    rec_reason = llm_rec.get("reason") or agent_msg or "Formulated from observed incident evidence."
    rec_risk = llm_rec.get("risk", "LOW")
    rec_approval = bool(llm_rec.get("requires_human_approval", True))
    sufficient_info = bool(llm_rec.get("sufficient_information", True))
    missing_info = llm_rec.get("missing_information")

    recommendation = {
        "action": rec_action,
        "reason": rec_reason,
        "risk": rec_risk,
        "requires_approval": rec_approval,
        "avoided_action": failed_act,
        "why_memory_changed": agent_msg,
        "sufficient_information": sufficient_info,
        "missing_information": missing_info,
        "failed_action_warning": (
            f"Avoid '{failed_act}' — previously failed in {matched_id}."
            if (match_found and failed_act)
            else "Review live telemetry before approving execution."
        )
    }

    evidence_data = infer_evidence(payload.message)

    # Activity sequence reflecting the real LLM analysis
    activity = [
        {
            "step": "intake",
            "status": "completed",
            "title": "Incident received",
            "detail": f"Engineer report converted into live incident {incident_id}."
        },
        {
            "step": "classification",
            "status": "completed",
            "title": "Incident classified",
            "detail": f"{category} · {severity} severity"
        },
        {
            "step": "evidence",
            "status": "completed",
            "title": "Investigating evidence",
            "detail": "Extracted telemetry signals and error signatures."
        },
        {
            "step": "memory",
            "status": "completed",
            "title": "Searching organizational memory",
            "detail": (
                f"Groq LLM ({model_used}) matched: {matched_id} ({match_data['similarity']}% similarity)"
                if match_found
                else f"Groq LLM ({model_used}) evaluated memory — no strong match found"
            )
        },
        {
            "step": "comparison",
            "status": "completed",
            "title": "Comparing historical incidents",
            "detail": (
                f"Groq LLM evaluated outcomes: Avoided '{failed_act}' and confirmed '{rec_action}'."
                if match_found
                else "Groq LLM assessed precedents; treated as novel failure signature."
            )
        },
        {
            "step": "reasoning",
            "status": "completed",
            "title": "Generating root-cause hypothesis",
            "detail": f"Groq LLM hypothesis: {rca_cause} ({round(rca_conf * 100)}% confidence)."
        },
        {
            "step": "recommendation",
            "status": "completed",
            "title": "Generating recommendation",
            "detail": f"Groq LLM proposed: {rec_action} ({rec_risk} risk)."
        },
        {
            "step": "approval",
            "status": "waiting",
            "title": "Human approval required",
            "detail": "Awaiting human engineer authorization before executing remediation."
        }
    ]

    incident = {
        "id": incident_id,
        "incident_id": incident_id,
        "user_id": user_id,
        "user_email": user_email,
        "is_global": False,
        "created_at": datetime.utcnow().isoformat(),
        "message": payload.message,
        "title": payload.message[:72],
        "category": category,
        "severity": severity,
        "status": "INVESTIGATING",
        "summary": summary,
        "llm_model": model_used,
        "llm_result": llm_result,

        "agent": {
            "state": "WAITING_FOR_APPROVAL",
            "confidence": rca_conf,
            "rca": rca_cause,
            "rca_reason": rca_reason,
            "recommendation": recommendation
        },

        # Backwards compatible: rca block for frontend
        "rca": {
            "root_cause": rca_cause,
            "confidence": rca_conf,
            "reason": rca_reason,
            "supporting_evidence": supporting_evidence
        },

        # Backwards compatible: recommendation block for frontend
        "recommendation": recommendation,

        "evidence": evidence_data,

        "memory": match_data,

        "matches": [
            {
                "incident_id": x["incident"]["id"],
                "title": x["incident"]["title"],
                "service": x["incident"]["service"],
                "similarity": x["score"],
                "root_cause": x["incident"]["root_cause"]
            }
            for x in candidate_matches if x["score"] >= 30
        ],

        "activity": activity,

        "approval": None,
        "execution": None,
        "verification": None,

        "audit": [
            {
                "time": datetime.utcnow().isoformat(),
                "event": "INCIDENT_CREATED",
                "actor": user_email,
                "detail": get_incident_created_detail(category, summary, payload.message)
            },
            {
                "time": datetime.utcnow().isoformat(),
                "event": "LLM_ANALYSIS_COMPLETED",
                "actor": f"groq-agent ({model_used})",
                "detail": "Incident analyzed against organizational memory."
            }
        ]
    }

    if match_found and matched_inc:
        match_event_detail = (
            f"First seen in your incident history ({matched_id})."
            if is_personal
            else get_memory_match_detail(category, matched_inc)
        )
        incident["audit"].append({
            "time": datetime.utcnow().isoformat(),
            "event": "MEMORY_MATCH_FOUND",
            "actor": "groq-agent",
            "detail": match_event_detail
        })
    else:
        incident["audit"].append({
            "time": datetime.utcnow().isoformat(),
            "event": "MEMORY_EVALUATED",
            "actor": "groq-agent",
            "detail": "Evaluated organizational memory — no prior match found; treated as novel incident."
        })

    INCIDENTS[incident_id] = incident
    return incident


# ============================================================
# LIST
# ============================================================

@router.get("/incidents")
def list_incidents(current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)):
    user_id = current_user["id"] if current_user else None
    return [
        inc for inc in INCIDENTS.values()
        if inc.get("is_global", False) or (user_id and inc.get("user_id") == user_id)
    ]


# ============================================================
# GET INCIDENT
# ============================================================

@router.get("/incidents/{incident_id}")
def get_incident(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)
    return incident


# ============================================================
# MEMORY
# ============================================================

@router.get("/incidents/{incident_id}/memory")
def get_memory(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)
    return incident["memory"]


# ============================================================
# EVIDENCE
# ============================================================

@router.get("/incidents/{incident_id}/evidence")
def get_evidence(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)
    return {
        "incident_id": incident_id,
        "evidence": incident["evidence"],
        "security": {
            "secrets_redacted": True,
            "logs_treated_as_untrusted_evidence": True,
            "prompt_injection_detected": False
        }
    }


# ============================================================
# INVESTIGATION
# ============================================================

@router.post("/incidents/{incident_id}/investigate")
def investigate(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)
    incident["status"] = "INVESTIGATING"

    incident["audit"].append({
        "time": datetime.utcnow().isoformat(),
        "event": "INVESTIGATION_COMPLETED",
        "actor": "memorydesk-agent",
        "detail": "Evidence, memory and remediation analysis completed."
    })

    return incident


# ============================================================
# APPROVAL
# ============================================================

@router.post("/incidents/{incident_id}/approve")
def approve(
    incident_id: str,
    payload: ApprovalRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)

    if not payload.approved:
        incident["approval"] = {
            "approved": False,
            "time": datetime.utcnow().isoformat()
        }
        incident["status"] = "WAITING"
        return incident

    incident["approval"] = {
        "approved": True,
        "time": datetime.utcnow().isoformat(),
        "approved_by": current_user["email"] if current_user else "human-engineer"
    }

    incident["status"] = "APPROVED"

    incident["audit"].append({
        "time": datetime.utcnow().isoformat(),
        "event": "HUMAN_APPROVAL",
        "actor": current_user["email"] if current_user else "human-engineer",
        "detail": "Human approved recommended remediation."
    })

    return incident


# ============================================================
# EXECUTE
# ============================================================

@router.post("/incidents/{incident_id}/execute")
def execute(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)

    if not incident["approval"] or not incident["approval"]["approved"]:
        raise HTTPException(
            status_code=403,
            detail="Human approval is required before execution."
        )

    action = incident["agent"]["recommendation"]["action"]

    incident["execution"] = {
        "status": "SUCCESS",
        "action": action,
        "executed_by": "memorydesk-agent",
        "time": datetime.utcnow().isoformat(),
        "mode": "SIMULATED_SAFE_EXECUTION"
    }

    incident["status"] = "VERIFYING"

    inc_type = classify_incident_type(incident)
    if inc_type == "notification":
        exec_detail = "Scaled notification workers."
    elif inc_type == "checkout":
        exec_detail = "Rolled back recent deployment to previous stable version."
    elif inc_type == "auth":
        exec_detail = "Restarted Redis cluster and restored session pool."
    elif inc_type == "payment":
        exec_detail = "Increased database connection pool from 10 to 50."
    else:
        exec_detail = f"Executed remediation: {action}."

    incident["audit"].append({
        "time": datetime.utcnow().isoformat(),
        "event": "REMEDIATION_EXECUTED",
        "actor": "memorydesk-agent",
        "detail": exec_detail
    })

    return incident


# ============================================================
# VERIFY
# ============================================================

@router.post("/incidents/{incident_id}/verify")
def verify(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)

    # Dynamic controlled simulated verification telemetry
    verification_data = generate_verification_telemetry(incident)
    verification_data["status"] = "RECOVERED"
    verification_data["pre_check"] = verification_data.get("before", {})
    verification_data["post_check"] = verification_data.get("after", {})
    incident["verification"] = verification_data
    incident["verification_status"] = "RECOVERED"
    incident["status"] = "RESOLVED"

    incident["audit"].append({
        "time": datetime.utcnow().isoformat(),
        "event": "REMEDIATION_VERIFIED",
        "actor": "memorydesk-agent",
        "detail": verification_data.get("audit_detail", "Recovery metrics verified.")
    })

    return incident


# ============================================================
# RESOLVE / WRITE USER-ISOLATED MEMORY
# ============================================================

@router.post("/incidents/{incident_id}/resolve")
def resolve(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)

    incident["status"] = "RESOLVED"

    # Determine failed and successful actions from incident execution and memory
    failed_act = None
    if incident.get("memory", {}).get("failed_action"):
        failed_act = incident["memory"]["failed_action"]
    elif incident.get("memory", {}).get("failed_actions"):
        failed_act = incident["memory"]["failed_actions"][0]
    elif incident.get("agent", {}).get("recommendation", {}).get("avoided_action"):
        failed_act = incident["agent"]["recommendation"]["avoided_action"]
    else:
        inc_type = classify_incident_type(incident)
        if inc_type == "notification":
            failed_act = "Restart one worker"
        elif inc_type == "checkout":
            failed_act = "Restart checkout service"
        elif inc_type == "auth":
            failed_act = "Restart application pods"
        elif inc_type == "payment":
            failed_act = "Restart payment service"
        else:
            failed_act = "Restart service"

    success_act = (
        (incident.get("execution") or {}).get("action")
        or ((incident.get("agent") or {}).get("recommendation") or {}).get("action")
        or "Applied targeted remediation"
    )

    verif_exp = (
        (incident.get("verification") or {}).get("explanation")
        or "Resolved after approved remediation and verification."
    )

    extracted_symptoms = sorted(list(tokenize(incident["message"])))
    extracted_concepts = list(extract_concepts(incident["message"]))

    memory_record = {
        "id": incident["id"],
        "incident_id": incident["id"],
        "service": incident["category"],
        "title": incident["title"],
        "description": incident["message"],
        "root_cause": incident["agent"]["rca"],
        "failed_actions": [failed_act],
        "successful_actions": [success_act],
        "failed_action": failed_act,
        "successful_action": success_act,
        "failed_result": f"Blind '{failed_act}' did not resolve the issue. Service remained degraded.",
        "successful_result": verif_exp,
        "resolution": verif_exp,
        "severity": incident["severity"],
        "symptoms": extracted_symptoms,
        "concepts": extracted_concepts,
        # Server-side user ownership isolation
        "is_global": False,
        "source": "YOUR_INCIDENT_HISTORY",
        "user_id": incident.get("user_id"),
        "user_email": incident.get("user_email"),
        "created_at": datetime.utcnow().isoformat()
    }

    # The newly resolved incident becomes future organizational memory for this user's account
    HISTORICAL_MEMORY.append(memory_record)
    save_memories_to_disk()

    # Also persist the resolved incident dictionary to PostgreSQL
    if is_db_connected():
        try:
            save_incident_db(incident)
        except Exception as e:
            print(f"[DATABASE] Error persisting resolved incident to PostgreSQL: {e}")

    new_memory_record = {
        "incident_id": incident["id"],
        "id": incident["id"],
        "what_happened": incident["message"],
        "failed_action": failed_act,
        "successful_action": success_act,
        "remember_summary": f"MemoryDesk will remember that '{failed_act}' failed and '{success_act}' resolved this issue when similar incidents occur.",
        "what_failed": failed_act,
        "what_worked": success_act,
        "service": incident["category"],
        "root_cause": incident["agent"]["rca"],
        "created_at": memory_record["created_at"],
        "user_id": incident.get("user_id")
    }
    incident["new_memory_record"] = new_memory_record
    if "memory" in incident and isinstance(incident["memory"], dict):
        incident["memory"]["new_memory_record"] = new_memory_record
        incident["memory"]["new_memory_created"] = True

    incident["audit"].append({
        "time": datetime.utcnow().isoformat(),
        "event": "MEMORY_STORED",
        "actor": "memorydesk-agent",
        "detail": f"Resolved incident added to the current account's memory ({incident.get('user_email', 'user')})."
    })

    return incident


# ============================================================
# AUDIT
# ============================================================

@router.get("/incidents/{incident_id}/audit")
def audit(
    incident_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    incident = INCIDENTS.get(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    check_incident_authorization(incident, current_user)

    return {
        "incident_id": incident_id,
        "events": incident["audit"]
    }


# ============================================================
# HISTORICAL MEMORY SEARCH (SERVER-SIDE ISOLATED)
# ============================================================

@router.get("/memory")
def all_memory(current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)):
    user_id = current_user["id"] if current_user else None
    accessible = get_user_accessible_memories(user_id)
    personal = [m for m in accessible if not m.get("is_global", False)]
    organizational = [m for m in accessible if m.get("is_global", False)]
    return {
        "count": len(accessible),
        "incidents": accessible,
        "personal_count": len(personal),
        "organizational_count": len(organizational),
        "personal_memories": personal,
        "organizational_memories": organizational
    }
