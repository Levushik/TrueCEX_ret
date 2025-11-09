"""
True CEX - Main Application Entry Point
FastAPI-based cryptocurrency exchange backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import all routers
from app.api import auth, trading, wallet, market

# Import database connection (this initializes tables on module import)
# Importing from app.database triggers Base.metadata.create_all() execution
import app.database

# Create FastAPI application
app = FastAPI(
    title="True CEX API",
    description="Centralized Cryptocurrency Exchange Platform",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for localhost testing
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PUT"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(trading.router, prefix="/api/trading", tags=["Trading"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet"])
app.include_router(market.router, prefix="/api/market", tags=["Market"])

# Health check endpoint
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "True CEX API running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
