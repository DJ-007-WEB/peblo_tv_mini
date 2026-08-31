from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .config import ADMIN_TOKEN, EDITOR_TOKEN

bearer = HTTPBearer(auto_error=False)
def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token required")
    token = credentials.credentials
    if token == ADMIN_TOKEN: return {"name": "admin", "role": "admin"}
    if token == EDITOR_TOKEN: return {"name": "editor", "role": "editor"}
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid bearer token")

def require_editor(user=Depends(current_user)):
    return user
def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user
