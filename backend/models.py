from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str

    conversations_a: List["Conversation"] = Relationship(back_populates="user_a_ref", sa_relationship_kwargs={"foreign_keys": "[Conversation.user_a]"})
    conversations_b: List["Conversation"] = Relationship(back_populates="user_b_ref", sa_relationship_kwargs={"foreign_keys": "[Conversation.user_b]"})


class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_a: int = Field(foreign_key="user.id")
    user_b: int = Field(foreign_key="user.id")

    user_a_ref: Optional[User] = Relationship(back_populates="conversations_a", sa_relationship_kwargs={"foreign_keys": "[Conversation.user_a]"})
    user_b_ref: Optional[User] = Relationship(back_populates="conversations_b", sa_relationship_kwargs={"foreign_keys": "[Conversation.user_b]"})

    messages: List["Message"] = Relationship(back_populates="conversation")


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversation.id")
    sender_id: int = Field(foreign_key="user.id")
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    conversation: Optional[Conversation] = Relationship(back_populates="messages")


