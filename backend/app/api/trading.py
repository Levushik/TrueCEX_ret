"""
Trading API endpoints
Handle order placement, cancellation, and order history with database persistence
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.models import Order, Trade, User
from app.database import get_db
from app.services.matching_engine import MatchingEngine
from app.api.auth import get_current_user_dependency

router = APIRouter()


# Pydantic schemas
class OrderRequest(BaseModel):
    """Order creation request"""
    symbol: str = Field(..., description="Trading pair symbol (e.g., BTC-USDT)")
    side: str = Field(..., description="Order side: buy or sell")
    order_type: str = Field(..., description="Order type: limit or market")
    price: Optional[float] = Field(None, description="Order price (required for limit orders)")
    quantity: float = Field(..., gt=0, description="Order quantity")


class OrderResponse(BaseModel):
    """Order response"""
    order_id: int = Field(..., description="Order ID")
    symbol: str = Field(..., description="Trading pair symbol")
    side: str = Field(..., description="Order side: buy or sell")
    order_type: str = Field(..., description="Order type: limit or market")
    price: Optional[float] = Field(None, description="Order price")
    quantity: float = Field(..., description="Order quantity")
    filled_quantity: float = Field(..., description="Filled quantity")
    status: str = Field(..., description="Order status: open, filled, cancelled")
    created_at: datetime = Field(..., description="Order creation timestamp")
    
    class Config:
        from_attributes = True


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_request: OrderRequest,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Create a new order
    
    - **symbol**: Trading pair (e.g., BTC-USDT)
    - **side**: buy or sell
    - **order_type**: limit or market
    - **price**: Order price (required for limit orders)
    - **quantity**: Order quantity
    
    Requires authentication.
    """
    try:
        # Validate: If order_type='limit', price must be provided
        if order_request.order_type == "limit" and order_request.price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Price is required for limit orders"
            )
        
        # Validate side
        if order_request.side not in ["buy", "sell"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Side must be 'buy' or 'sell'"
            )
        
        # Validate order_type
        if order_request.order_type not in ["limit", "market"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order type must be 'limit' or 'market'"
            )
        
        # Validate price for limit orders
        if order_request.order_type == "limit" and order_request.price <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Price must be greater than 0 for limit orders"
            )
        
        # Create Order object
        new_order = Order(
            user_id=current_user.id,
            symbol=order_request.symbol,
            side=order_request.side,
            order_type=order_request.order_type,
            price=order_request.price,  # None for market orders
            quantity=order_request.quantity,
            filled_quantity=0.0,
            status="open",
            created_at=datetime.utcnow()
        )
        
        # Save to database
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        
        # Initialize MatchingEngine and match the order
        try:
            matching_engine = MatchingEngine(db)
            trades = matching_engine.place_order(new_order)
            
            # Refresh order to get updated status and filled_quantity
            db.refresh(new_order)
        except Exception as e:
            # If matching fails, order is still created but not matched
            # Log error but don't fail the order creation
            pass
        
        # Return OrderResponse
        return OrderResponse(
            order_id=new_order.id,
            symbol=new_order.symbol,
            side=new_order.side,
            order_type=new_order.order_type,
            price=new_order.price,
            quantity=new_order.quantity,
            filled_quantity=new_order.filled_quantity,
            status=new_order.status,
            created_at=new_order.created_at
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )


@router.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    status: Optional[str] = Query(None, description="Filter by status (open, filled, cancelled)"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get user's order history
    
    - **symbol**: Optional filter by trading pair
    - **status**: Optional filter by order status
    
    Requires authentication.
    """
    try:
        # Query all orders from Order table where user_id = current_user.id
        query = db.query(Order).filter(Order.user_id == current_user.id)
        
        # Apply optional filters
        if symbol:
            query = query.filter(Order.symbol == symbol)
        
        if status:
            query = query.filter(Order.status == status)
        
        # Order by created_at descending (newest first)
        orders = query.order_by(Order.created_at.desc()).all()
        
        # Convert to OrderResponse
        return [
            OrderResponse(
                order_id=order.id,
                symbol=order.symbol,
                side=order.side,
                order_type=order.order_type,
                price=order.price,
                quantity=order.quantity,
                filled_quantity=order.filled_quantity,
                status=order.status,
                created_at=order.created_at
            )
            for order in orders
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get orders: {str(e)}"
        )


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get specific order details
    
    - **order_id**: Order ID
    
    Requires authentication.
    """
    try:
        # Query specific order
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Check belongs to current_user (raise 403 if not)
        if order.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Order does not belong to current user"
            )
        
        # Return OrderResponse
        return OrderResponse(
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            order_type=order.order_type,
            price=order.price,
            quantity=order.quantity,
            filled_quantity=order.filled_quantity,
            status=order.status,
            created_at=order.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get order: {str(e)}"
        )


@router.delete("/orders/{order_id}", status_code=status.HTTP_200_OK)
async def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Cancel an existing order
    
    - **order_id**: Order ID to cancel
    
    Requires authentication.
    Only open orders can be cancelled.
    """
    try:
        # Query order
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Check order belongs to current_user (raise 403 if not)
        if order.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Order does not belong to current user"
            )
        
        # Check status is 'open' (raise 400 if filled/cancelled)
        if order.status != "open":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel order with status: {order.status}"
            )
        
        # Set status = 'cancelled'
        order.status = "cancelled"
        
        # Save to database
        db.commit()
        
        return {
            "message": "Order cancelled",
            "order_id": order_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel order: {str(e)}"
        )
