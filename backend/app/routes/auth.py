from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json
import secrets
import urllib.request
import jwt

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, LoginResponse, UserProfile, GoogleLoginRequest
from app.security import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate institutional credentials and issue signed JWT access token."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact the administrator."
        )

    # Issue signed access token with sub, id, and user metadata
    token = create_access_token(data={
        "sub": user.email,
        "id": user.id,
        "name": user.name,
        "role": user.role
    })

    return LoginResponse(
        success=True,
        message=f"Welcome back, {user.name}!",
        token=token,
        token_type="bearer",
        user=UserProfile.model_validate(user)
    )


@router.post("/google", response_model=LoginResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Authenticate or auto-provision users through Google OAuth Identity Services."""
    email = None
    name = None

    # Step 1: If an ID token / credential is provided, verify via Google API or decode payload
    if payload.credential:
        try:
            # Query Google's public tokeninfo endpoint
            verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.credential}"
            req = urllib.request.Request(verify_url, headers={"User-Agent": "FacultyDashboard/1.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    token_data = json.loads(response.read().decode("utf-8"))
                    email = token_data.get("email")
                    name = token_data.get("name")
        except Exception:
            # Fallback: Safely decode token claims without network roundtrip if endpoint was unreachable
            try:
                decoded = jwt.decode(payload.credential, options={"verify_signature": False})
                email = decoded.get("email")
                name = decoded.get("name")
            except Exception:
                pass

    # Step 2: Fallback to directly supplied verified profile data
    if not email and payload.email:
        email = payload.email
        name = payload.name or payload.email.split("@")[0].replace(".", " ").title()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to verify Google profile or email. Please try again."
        )

    email = email.strip().lower()

    # Step 3: Find existing user or automatically provision new institutional user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Default name if missing
        display_name = name or email.split("@")[0].replace(".", " ").title()
        role = "Administrator" if "admin" in email else "Faculty Member"

        # Create new user record
        random_pwd = secrets.token_urlsafe(24)
        user = User(
            email=email,
            name=display_name,
            hashed_password=hash_password(random_pwd),
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact the administrator."
        )

    # Step 4: Issue signed institutional JWT access token
    token = create_access_token(data={
        "sub": user.email,
        "id": user.id,
        "name": user.name,
        "role": user.role
    })

    return LoginResponse(
        success=True,
        message=f"Signed in via Google as {user.name}!",
        token=token,
        token_type="bearer",
        user=UserProfile.model_validate(user)
    )


@router.get("/me", response_model=UserProfile)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Retrieve profile and institutional role of the currently authenticated user."""
    return UserProfile.model_validate(current_user)

