import uuid
from typing import Any, Dict, Optional
import pandas as pd

# In-memory session store
# Cukup untuk portofolio; production pakai Redis
_sessions: Dict[str, Dict[str, Any]] = {}

def create_session() -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {}
    return session_id

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    return _sessions.get(session_id)

def set_session_value(session_id: str, key: str, value: Any) -> None:
    if session_id not in _sessions:
        _sessions[session_id] = {}
    _sessions[session_id][key] = value

def get_session_value(session_id: str, key: str) -> Optional[Any]:
    session = _sessions.get(session_id)
    if session is None:
        return None
    return session.get(key)

def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)