import os
import json
import hashlib
import hmac
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

SECRET_KEY = os.environ.get("JWT_SECRET", "memorydesk-production-grade-jwt-secret-key-2026-auth-protection")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


# ============================================================
# CRYPTOGRAPHY / HASHING
# ============================================================

def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, dk_hex = hashed.split("$")
        test_dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return hmac.compare_digest(test_dk.hex(), dk_hex)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta_hours: int = ACCESS_TOKEN_EXPIRE_HOURS) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=expires_delta_hours)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


# ============================================================
# IN-MEMORY USER STORE
# Seeded with User 1 (chidek) and User 2 (afreen)
# ============================================================

USERS: Dict[str, Dict[str, Any]] = {
    "usr_chidek": {
        "id": "usr_chidek",
        "username": "chidek",
        "name": "chidek",
        "email": "chidek",
        "password_hash": hash_password("cmrit"),
        "created_at": datetime.utcnow().isoformat()
    },
    "usr_afreen": {
        "id": "usr_afreen",
        "username": "afreen",
        "name": "afreen",
        "email": "afreen",
        "password_hash": hash_password("cmrcet"),
        "created_at": datetime.utcnow().isoformat()
    }
}

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
USERS_FILE = DATA_DIR / "users.json"

def save_users_to_disk():
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(USERS, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving users to disk: {e}")

def load_users_from_disk():
    try:
        if USERS_FILE.exists():
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                USERS.update(saved)
    except Exception as e:
        print(f"Error loading users from disk: {e}")

load_users_from_disk()


def find_user_by_identifier(identifier: str) -> Optional[Dict[str, Any]]:
    clean_id = identifier.strip().lower()
    for user in USERS.values():
        if (
            user.get("username", "").strip().lower() == clean_id
            or user.get("email", "").strip().lower() == clean_id
            or user.get("id", "").strip().lower() == clean_id
            or user.get("name", "").strip().lower() == clean_id
        ):
            return user
    return None

find_user_by_email = find_user_by_identifier


# ============================================================
# REQUEST / RESPONSE SCHEMAS
# ============================================================

class RegisterRequest(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str


# ============================================================
# DEPENDENCIES
# ============================================================

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Dict[str, Any]:
    """
    Enforces authentication. Derives user strictly from the JWT Bearer token.
    DO NOT trust user_id supplied by the frontend body.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please log in with your MemoryDesk account."
        )
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session token. Please log in again."
        )
    user_id = payload["sub"]
    user = USERS.get(user_id)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User account no longer exists."
        )
    return user


def get_optional_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Optional[Dict[str, Any]]:
    """
    Returns authenticated user if valid token exists, otherwise None.
    """
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user_id = payload["sub"]
    return USERS.get(user_id)


# ============================================================
# AUTH ROUTES
# ============================================================

@router.post("/register")
def register(payload: RegisterRequest):
    identifier = (payload.username or payload.email or "").strip().lower()
    name = (payload.name or identifier).strip()
    password = payload.password
    confirm_password = payload.confirm_password

    if not identifier or len(identifier) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    if find_user_by_identifier(identifier):
        raise HTTPException(status_code=400, detail="An account with this username already exists.")

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    new_user = {
        "id": user_id,
        "username": identifier,
        "name": name,
        "email": identifier,
        "password_hash": hash_password(password),
        "created_at": datetime.utcnow().isoformat()
    }
    USERS[user_id] = new_user
    save_users_to_disk()

    token = create_access_token({
        "sub": user_id,
        "username": identifier,
        "email": identifier,
        "name": name
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": identifier,
            "name": name,
            "email": identifier
        }
    }


@router.post("/login")
def login(payload: LoginRequest):
    identifier = (payload.username or payload.email or "").strip().lower()
    password = payload.password

    if not identifier:
        raise HTTPException(
            status_code=400,
            detail="Username is required."
        )

    user = find_user_by_identifier(identifier)
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password."
        )

    uname = user.get("username") or user.get("name") or user.get("email")
    token = create_access_token({
        "sub": user["id"],
        "username": uname,
        "email": user["email"],
        "name": user["name"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": uname,
            "name": user["name"],
            "email": user["email"]
        }
    }


@router.get("/me")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    uname = current_user.get("username") or current_user.get("name") or current_user.get("email")
    return {
        "id": current_user["id"],
        "username": uname,
        "name": current_user["name"],
        "email": current_user["email"]
    }


@router.post("/logout")
def logout():
    return {"status": "logged_out", "message": "Session terminated successfully."}
