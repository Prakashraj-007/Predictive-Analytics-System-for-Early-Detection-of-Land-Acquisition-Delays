"""
Me Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3.
"""
from fastapi import APIRouter
from app.schemas import UserProfile

router = APIRouter(tags=["User Profile"])

@router.get("/me", response_model=UserProfile)
def get_current_user_profile():
    # Stub default user profile (Person A / PM demo user)
    return UserProfile(
        user_id="5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        full_name="Priya Sharma (PM)",
        role="project_manager",
        district="Pune"
    )
