"""Request and response bodies of /api/auth."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.users.schemas import UserOut


class AuthConfig(BaseModel):
    allow_self_signup: bool


class LoginStart(BaseModel):
    email: EmailStr


class LoginStartResult(BaseModel):
    method: Literal["otp", "password"]


class LoginVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    # Exactly one of code and password (checked by the endpoint).
    code: str | None = Field(default=None, max_length=12)
    password: str | None = Field(default=None, max_length=1024)


class SessionOut(BaseModel):
    access_token: str
    user: UserOut


class LoginResult(SessionOut):
    is_new: bool


class ChangePassword(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str | None = Field(default=None, max_length=1024)
    new_password: str = Field(max_length=1024)
