from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.models import User, ActivityLog
from schemas.schemas import SignupRequest, LoginRequest, TokenResponse, UserOut, UserUpdate, ActivityLogOut
from auth.security import hash_password, verify_password, create_access_token, get_current_user
from typing import List

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    is_first_user = db.query(User).count() == 0
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role="admin" if is_first_user else "analyst",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    activity = ActivityLog(user_id=user.id, action="signup", details={"email": user.email})
    db.add(activity)
    db.commit()

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    activity = ActivityLog(user_id=user.id, action="login", details={"email": user.email})
    db.add(activity)
    db.commit()

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout")
def logout(user: User = Depends(get_current_user)):
    # Stateless JWT - client discards the token. Endpoint kept for API symmetry
    # and to support future token-blacklisting if refresh tokens are added.
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.put("/profile", response_model=UserOut)
def update_profile(payload: UserUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.n8n_webhook_url is not None:
        user.n8n_webhook_url = payload.n8n_webhook_url
    
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/forgot-password")
def forgot_password(payload: dict, db: Session = Depends(get_db)):
    """
    Demo-safe password reset trigger. Always returns a generic success
    message (never reveals whether the email exists) to avoid account
    enumeration. Wire up a transactional email provider in production to
    actually deliver the reset link.
    """
    email = payload.get("email", "")
    user = db.query(User).filter(User.email == email).first()
    if user:
        logger_token = create_access_token(user.id)  # would be emailed as a reset link in production
    return {"message": "If an account with that email exists, password reset instructions have been sent."}


@router.get("/activity", response_model=List[ActivityLogOut])
def get_activity(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(ActivityLog).filter(ActivityLog.user_id == user.id).order_by(ActivityLog.timestamp.desc()).limit(50).all()
    return logs
