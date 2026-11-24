"""User representations shared by the auth and users APIs."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.users.models import AuthMethod, Language, Role, Theme

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str
    last_name: str
    role: Role
    auth_method: AuthMethod
    language: Language
    theme: Theme
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Name | None = None
    last_name: Name | None = None
    language: Language | None = None
    theme: Theme | None = None
