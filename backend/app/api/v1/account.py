from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.credits import CreditCost, CreditTransaction
from app.models.payment import Payment
from app.models.progress import PurchasePlan, Recommendation, UserProgress
from app.models.study import StudyTask
from app.models.user import User
from app.services.analytics import AnalyticsService
from app.services.credits import CreditService

router = APIRouter(tags=["account"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    CreditService(db).ensure_wallet(user)
    data = AnalyticsService(db).dashboard(user)
    recs = db.scalars(
        select(Recommendation)
        .where(Recommendation.user_id == user.id, Recommendation.is_dismissed.is_(False))
        .order_by(Recommendation.priority.desc())
        .limit(6)
    ).all()
    tasks = db.scalars(
        select(StudyTask)
        .where(StudyTask.user_id == user.id)
        .order_by(StudyTask.scheduled_for.asc())
        .limit(6)
    ).all()
    data["recommendations"] = [
        {"title": r.title, "rationale": r.rationale, "path": r.action_path, "kind": r.kind}
        for r in recs
    ]
    data["todays_plan"] = [{"id": str(t.id), "title": t.title, "type": t.task_type, "done": t.completed} for t in tasks]
    data["credits"] = user.wallet.balance if user.wallet else data["credits"]
    return data


@router.get("/analytics")
def analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payload = AnalyticsService(db).full(user)
    subjects = db.scalars(select(UserProgress).where(UserProgress.user_id == user.id)).all()
    payload["subject_accuracy"] = [
        {
            "subject_id": str(row.subject_id) if row.subject_id else None,
            "topic_id": str(row.topic_id) if row.topic_id else None,
            "accuracy": row.accuracy,
            "attempted": row.questions_attempted,
            "trend": row.trend,
        }
        for row in subjects
    ]
    return payload


@router.get("/credits/balance")
def credits_balance(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    wallet = CreditService(db).ensure_wallet(user)
    db.commit()
    return {"balance": wallet.balance}


@router.get("/credits")
def credits(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    CreditService(db).ensure_wallet(user)
    db.refresh(user)
    costs = {c.action_key: c.credits for c in db.scalars(select(CreditCost)).all()}
    txs = db.scalars(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(50)
    ).all()
    plans = db.scalars(select(PurchasePlan)).all()
    payments = db.scalars(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc()).limit(20)
    ).all()
    balance = user.wallet.balance
    eval_cost = costs.get("evaluation", 10)
    flash_cost = costs.get("flashcard_generation", 5)
    return {
        "balance": balance,
        "estimated_evaluations": balance // eval_cost if eval_cost else 0,
        "estimated_flashcard_generations": balance // flash_cost if flash_cost else 0,
        "costs": costs,
        "transactions": [
            {
                "id": str(tx.id),
                "amount": tx.amount,
                "balance_after": tx.balance_after,
                "type": tx.transaction_type,
                "note": tx.note,
                "created_at": tx.created_at.isoformat(),
            }
            for tx in txs
        ],
        "plans": [
            {
                "code": p.code,
                "name": p.name,
                "price_inr": p.price_inr,
                "credits": p.credits,
                "badge": p.badge,
                "placeholder": p.is_placeholder,
            }
            for p in plans
        ],
        "payments": [
            {
                "id": str(row.id),
                "plan_code": row.plan_code,
                "price_inr": row.price_inr,
                "credits": row.credits,
                "status": str(row.status),
                "failure_message": row.failure_message,
                "created_at": row.created_at.isoformat(),
            }
            for row in payments
        ],
    }


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Recommendation).where(
            Recommendation.user_id == user.id, Recommendation.is_dismissed.is_(False)
        )
    ).all()
    return [{"title": r.title, "rationale": r.rationale, "path": r.action_path, "kind": r.kind} for r in rows]
