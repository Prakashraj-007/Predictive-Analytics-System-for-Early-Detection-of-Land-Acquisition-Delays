"""
Me Router for LandSentinel.
Returns profile of the authenticated user.
Strictly adheres to docs/contracts.md section 3.
"""
from fastapi import APIRouter, Depends
from app.schemas import UserProfile
from app.auth import CurrentUser, get_current_user

router = APIRouter(tags=["User Profile"])

@router.get("/me", response_model=UserProfile)
def get_current_user_profile(user: CurrentUser = Depends(get_current_user)):
    return UserProfile(
        user_id=user.user_id,
        full_name=user.full_name,
        role=user.role,
        district=user.district
    )
