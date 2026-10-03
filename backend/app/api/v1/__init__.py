from fastapi import APIRouter

from app.api.v1 import account, admin, auth, catalog, evaluations, mocks, payments, questions, study

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(questions.router)
api_router.include_router(evaluations.router)
api_router.include_router(study.router)
api_router.include_router(mocks.router)
api_router.include_router(account.router)
api_router.include_router(payments.router)
api_router.include_router(admin.router)
