"""JWT authentication utilities for Supabase Auth."""

import os
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

# Supabase JWKS endpoint for ES256 key verification
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

# Lazy-loaded JWKS client (caches keys)
_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> PyJWKClient:
    """Get or create the JWKS client."""
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise ValueError("SUPABASE_URL not configured")
        _jwks_client = PyJWKClient(JWKS_URL)
    return _jwks_client


def verify_token(token: str) -> dict:
    """Verify a Supabase JWT and return the payload."""
    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency to get the current authenticated user.

    Usage:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            return {"user_id": user["sub"]}
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = parts[1]
    return verify_token(token)


async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """FastAPI dependency that returns the user if authenticated, or None.

    Use this for routes that work for both authenticated and anonymous users.

    Usage:
        @app.get("/public-or-private")
        async def flexible_route(user: dict | None = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello, {user['email']}"}
            return {"message": "Hello, anonymous"}
    """
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    try:
        token = parts[1]
        return verify_token(token)
    except HTTPException:
        return None
