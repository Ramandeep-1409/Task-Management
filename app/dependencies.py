from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError

from .database import get_db
from .models import User, ProjectMember, RoleEnum
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def get_project_membership(project_id: int, current_user: User, db: Session) -> ProjectMember:
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    return membership


def require_project_admin(project_id: int, current_user: User, db: Session) -> ProjectMember:
    membership = get_project_membership(project_id, current_user, db)
    if membership.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    if current_user.account_role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Project Lead account required for this action",
        )
    return membership


def require_account_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.account_role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only Project Lead accounts can perform this action",
        )
    return current_user
