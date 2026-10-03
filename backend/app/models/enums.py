from enum import StrEnum


class UserRole(StrEnum):
    STUDENT = "student"
    ADMIN = "admin"


class QuestionType(StrEnum):
    MCQ = "MCQ"
    MSQ = "MSQ"
    NAT = "NAT"
    DESCRIPTIVE = "DESCRIPTIVE"


class SourceType(StrEnum):
    OFFICIAL_PYQ = "OFFICIAL_PYQ"
    ADMIN_CREATED = "ADMIN_CREATED"
    AI_GENERATED = "AI_GENERATED"
    USER_CREATED = "USER_CREATED"
    DEMO = "DEMO"


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CreditTransactionType(StrEnum):
    STARTER_CREDIT = "STARTER_CREDIT"
    PURCHASE = "PURCHASE"
    AI_EVALUATION = "AI_EVALUATION"
    FLASHCARD_GENERATION = "FLASHCARD_GENERATION"
    AI_TUTOR = "AI_TUTOR"
    QUESTION_GENERATION = "QUESTION_GENERATION"
    MOCK_ANALYSIS = "MOCK_ANALYSIS"
    REFUND = "REFUND"
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"


class PreparationLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ExamMode(StrEnum):
    CONCEPT_BUILDING = "concept_building"
    PYQ_FOCUSED = "pyq_focused"
    MOCK_FOCUSED = "mock_focused"
    REVISION = "revision"


class EvaluationStatus(StrEnum):
    DRAFT = "draft"
    OCR_PENDING = "ocr_pending"
    READY_FOR_REVIEW = "ready_for_review"
    EVALUATING = "evaluating"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class FlashcardFocus(StrEnum):
    QUICK_FACTS = "quick_facts"
    KEY_CONCEPTS = "key_concepts"
    FORMULAS = "formulas"
    COMMON_MISTAKES = "common_mistakes"
    RECURRING_PATTERNS = "recurring_patterns"
    DEFINITIONS = "definitions"
    PYQ_INSIGHTS = "pyq_insights"
    CONCEPT_QUESTIONS = "concept_questions"
    CUSTOM = "custom"


class ReviewRating(StrEnum):
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


class AttemptStatus(StrEnum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    ABANDONED = "abandoned"


class BookmarkTarget(StrEnum):
    QUESTION = "question"
    FLASHCARD = "flashcard"
    TOPIC = "topic"


class PromptName(StrEnum):
    EVALUATION = "evaluation"
    FLASHCARDS = "flashcards"
    TUTOR = "tutor"
    QUESTION_GENERATION = "question_generation"
    RECOMMENDATIONS = "recommendations"
    STUDY_PLAN = "study_plan"
    OCR_POSTPROCESS = "ocr_postprocess"
    WEAKNESS = "weakness"
