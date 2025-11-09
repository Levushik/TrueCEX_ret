"""
Wallet API endpoints
"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/balances")
async def get_balances():
    """Get user wallet balances"""
    return {"message": "Wallet endpoint placeholder"}
