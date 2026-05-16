from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import User
from ..schemas import UserResponse
from ..dependencies import get_current_user

router = APIRouter()


@router.get("/search", response_model=List[UserResponse])
def search_users(
    email: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = (
        db.query(User)
        .filter(User.email.ilike(f"%{email}%"), User.id != current_user.id)
        .limit(10)
        .all()
    )
    return users
