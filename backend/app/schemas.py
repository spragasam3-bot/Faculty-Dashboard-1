from typing import List, Optional
from datetime import datetime
import re
from pydantic import BaseModel, Field, field_validator, model_validator


# ==========================================
# FACULTY SCHEMAS
# ==========================================

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

class FacultyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Faculty full name")
    department: str = Field(..., min_length=2, max_length=100, description="Department name")
    designation: str = Field(..., min_length=2, max_length=100, description="Designation (e.g. Professor)")
    email: str = Field(..., min_length=5, max_length=150, description="Institutional email address")
    joining_date: str = Field(..., description="Joining date format YYYY-MM-DD")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(EMAIL_REGEX, v):
            raise ValueError("Please provide a valid email address (e.g. name@university.edu)")
        return v


class FacultyCreate(FacultyBase):
    pass


class FacultyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    department: Optional[str] = Field(None, min_length=2, max_length=100)
    designation: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[str] = None
    joining_date: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().lower()
            if not re.match(EMAIL_REGEX, v):
                raise ValueError("Please provide a valid email address (e.g. name@university.edu)")
        return v


class FacultyResponse(FacultyBase):
    id: int
    created_at: Optional[datetime] = None
    activity_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ==========================================
# ACTIVITY SCHEMAS
# ==========================================

class ActivityBase(BaseModel):
    faculty_id: int = Field(..., description="ID of the faculty member")
    title: str = Field(..., min_length=3, max_length=255, description="Title of the activity")
    category: str = Field(..., description="Category: Teaching, Publication, FDP, Consultancy, Patent")
    year: int = Field(..., ge=1990, le=2050, description="Academic year e.g. 2025")
    date_or_period: Optional[str] = Field(None, max_length=100, description="Date or semester duration")
    status: str = Field(..., description="Status e.g. Completed, Ongoing, Published, Granted")
    description: Optional[str] = Field(None, description="Detailed description or notes")
    metric_value: Optional[float] = Field(0.0, ge=0, description="Numeric metric (hours/week, funding amount, etc.)")
    publisher_or_organization: Optional[str] = Field(None, max_length=200, description="Journal/Organizer/Client")


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    faculty_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    category: Optional[str] = None
    year: Optional[int] = Field(None, ge=1990, le=2050)
    date_or_period: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    metric_value: Optional[float] = Field(None, ge=0)
    publisher_or_organization: Optional[str] = None


class ActivityResponse(ActivityBase):
    id: int
    created_at: Optional[datetime] = None
    faculty_name: Optional[str] = None
    faculty_department: Optional[str] = None

    class Config:
        from_attributes = True


# ==========================================
# DASHBOARD SCHEMAS
# ==========================================

class CategoryStat(BaseModel):
    category: str
    count: int
    percentage: float


class DepartmentStat(BaseModel):
    department: str
    faculty_count: int
    activity_count: int


class YearTrendStat(BaseModel):
    year: int
    count: int


class DashboardStatsResponse(BaseModel):
    total_faculty: int
    total_activities: int
    teaching_count: int
    total_teaching_hours: float
    publications_count: int
    fdps_count: int
    consultancy_count: int
    total_consultancy_amount: float
    patents_count: int
    category_distribution: List[CategoryStat]
    department_stats: List[DepartmentStat]
    year_trends: List[YearTrendStat]
    recent_activities: List[ActivityResponse]


# ==========================================
# APPRAISAL SCHEMAS
# ==========================================

class CategoryScoreDetail(BaseModel):
    category: str
    count: int
    unit_points: int
    multiplier_label: str
    subtotal_score: float
    notes: str


class FacultyAppraisalResponse(BaseModel):
    faculty: FacultyResponse
    total_score: float
    performance_rating: str  # Outstanding, Excellent, Very Good, Satisfactory, Needs Improvement
    score_breakdown: List[CategoryScoreDetail]
    activities: List[ActivityResponse]
    calculation_summary: str


# ==========================================
# AUTH SCHEMAS
# ==========================================

class LoginRequest(BaseModel):
    email: Optional[str] = Field(None, description="Institutional email address")
    username: Optional[str] = Field(None, description="Alternative email/username field")
    password: str = Field(..., min_length=1, description="Account password")

    @field_validator("password")
    @classmethod
    def validate_password_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Password is required.")
        return v

    @model_validator(mode="after")
    def validate_credentials(self):
        target = self.email or self.username
        if not target or not target.strip():
            raise ValueError("Institutional email is required.")
        normalized = target.strip().lower()
        if not re.match(EMAIL_REGEX, normalized):
            raise ValueError("Please provide a valid institutional email address (e.g. admin@university.edu).")
        self.email = normalized
        return self


class UserProfile(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    success: bool = True
    message: str
    token: str
    token_type: str = "bearer"
    user: UserProfile


class GoogleLoginRequest(BaseModel):
    credential: Optional[str] = Field(None, description="Google OAuth ID Token / credential")
    email: Optional[str] = Field(None, description="Google verified user email")
    name: Optional[str] = Field(None, description="Google user full name")
    sub: Optional[str] = Field(None, description="Google user unique ID")


