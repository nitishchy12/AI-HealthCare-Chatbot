from typing import Literal

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class AssessmentRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=1000)
    language: Literal["en", "hi"] = "en"
    conversation_history: list[ConversationMessage] = Field(default_factory=list)
    user_id: int | None = None


class Citation(BaseModel):
    id: int
    source: str
    snippet: str
    url: str = ""


class AssessmentResponse(BaseModel):
    answer_md: str
    symptoms_detected: list[str] = Field(default_factory=list)
    possible_causes: list[str] = Field(default_factory=list)
    risk_level: Literal["Low", "Medium", "High"] = "Low"
    risk_reasoning: str = ""
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    recommended_actions: list[str] = Field(default_factory=list)
    when_to_seek_care: str = ""
    specialists_suggested: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    disclaimer: str = "This information is for health awareness only and not a substitute for professional medical advice."
    prompt_version: str = ""
    latency_ms: int = 0


class HealthCheckResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    embedding_model: str = ""
    qdrant: str = ""
    redis: str = ""
