"""Authentication schemas."""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserInfo(BaseModel):
    user_id: str
    email: str
    name: str


class UserResponse(BaseModel):
    success: bool
    user: UserInfo
