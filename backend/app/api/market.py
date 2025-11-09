"""
Market Data API endpoints
Order book and ticker information from database
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List

from app.models import Order
from app.database import get_db

router = APIRouter()


# Pydantic schemas
class OrderLevel(BaseModel):
    """Order book level"""
    price: float = Field(..., description="Order price")
    quantity: float = Field(..., description="Remaining quantity")


class TickerResponse(BaseModel):
    """Ticker response"""
    symbol: str = Field(..., description="Trading pair symbol")
    last_price: Optional[float] = Field(None, description="Last/mid price")
    bid: Optional[float] = Field(None, description="Best bid price")
    ask: Optional[float] = Field(None, description="Best ask price")


class OrderbookResponse(BaseModel):
    """Order book response"""
    symbol: str = Field(..., description="Trading pair symbol")
    bids: List[OrderLevel] = Field(default_factory=list, description="Buy orders (bids)")
    asks: List[OrderLevel] = Field(default_factory=list, description="Sell orders (asks)")
    spread: float = Field(..., description="Spread between best ask and best bid")


@router.get("/orderbook/{symbol}", response_model=OrderbookResponse)
async def get_orderbook(symbol: str, db: Session = Depends(get_db)):
    """
    Get order book for a trading pair
    Returns current bids, asks, and spread for the symbol from database
    """
    try:
        # Query ALL OPEN orders from Order table where symbol matches and status='open'
        open_orders = db.query(Order).filter(
            Order.symbol == symbol,
            Order.status == "open"
        ).all()
        
        # Separate into bids (side='buy') and asks (side='sell')
        bids = []
        asks = []
        
        for order in open_orders:
            # Calculate remaining quantity (quantity - filled_quantity)
            remaining_quantity = order.quantity - order.filled_quantity
            
            # Skip orders with no remaining quantity
            if remaining_quantity <= 0:
                continue
            
            # Skip orders without price (market orders)
            if order.price is None:
                continue
            
            order_level = OrderLevel(
                price=order.price,
                quantity=remaining_quantity
            )
            
            if order.side == "buy":
                bids.append(order_level)
            elif order.side == "sell":
                asks.append(order_level)
        
        # Sort bids DESCENDING by price (highest first)
        bids.sort(key=lambda x: x.price, reverse=True)
        
        # Sort asks ASCENDING by price (lowest first)
        asks.sort(key=lambda x: x.price)
        
        # Calculate spread = best_ask - best_bid
        best_bid = bids[0].price if bids else None
        best_ask = asks[0].price if asks else None
        
        spread = 0.0
        if best_bid is not None and best_ask is not None:
            spread = best_ask - best_bid
        
        return OrderbookResponse(
            symbol=symbol,
            bids=bids,
            asks=asks,
            spread=spread
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get orderbook: {str(e)}"
        )


@router.get("/ticker/{symbol}", response_model=TickerResponse)
async def get_ticker(symbol: str, db: Session = Depends(get_db)):
    """
    Get ticker information for a trading pair
    Returns last price, best bid, and best ask from database
    """
    try:
        # Query open orders for the symbol
        open_orders = db.query(Order).filter(
            Order.symbol == symbol,
            Order.status == "open"
        ).all()
        
        # Extract best_bid (highest price in buy orders)
        buy_orders = [
            order for order in open_orders
            if order.side == "buy" 
            and order.price is not None 
            and (order.quantity - order.filled_quantity) > 0
        ]
        
        # Extract best_ask (lowest price in sell orders)
        sell_orders = [
            order for order in open_orders
            if order.side == "sell"
            and order.price is not None
            and (order.quantity - order.filled_quantity) > 0
        ]
        
        best_bid = None
        best_ask = None
        
        if buy_orders:
            # Find highest price in buy orders
            best_bid = max(order.price for order in buy_orders)
        
        if sell_orders:
            # Find lowest price in sell orders
            best_ask = min(order.price for order in sell_orders)
        
        # Calculate last_price = (best_bid + best_ask) / 2
        # If only one side exists, use that price
        last_price = None
        if best_bid is not None and best_ask is not None:
            last_price = (best_bid + best_ask) / 2.0
        elif best_bid is not None:
            last_price = best_bid
        elif best_ask is not None:
            last_price = best_ask
        
        return TickerResponse(
            symbol=symbol,
            last_price=last_price,
            bid=best_bid,
            ask=best_ask
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ticker: {str(e)}"
        )
