"""
Order Matching Engine
Matches orders from different users when prices align
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import List

from app.models import Order, Trade


class MatchingEngine:
    """Order matching engine that works with database"""
    
    def __init__(self, db: Session):
        """
        Initialize matching engine with database session
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
    
    def place_order(self, order: Order) -> List[Trade]:
        """
        Place an order and match it with existing orders
        
        Args:
            order: Order object (already saved to DB with user_id, symbol, side, price, quantity)
        
        Returns:
            List of Trade objects created
        """
        trades = []
        
        # Ensure order is attached to session
        self.db.refresh(order)
        
        # Check if order is still open
        if order.status != "open":
            return trades
        
        # Calculate remaining quantity
        remaining = order.quantity - order.filled_quantity
        
        if remaining <= 0:
            return trades
        
        # Find matching orders based on side
        if order.side == "buy":
            # For buy orders: find open SELL orders
            matching_orders = self._find_matching_sell_orders(order)
        else:  # side == "sell"
            # For sell orders: find open BUY orders
            matching_orders = self._find_matching_buy_orders(order)
        
        # Match with each order until current order is filled
        for matching_order in matching_orders:
            if remaining <= 0:
                break
            
            # Ensure matching order is still open and not the same order
            self.db.refresh(matching_order)
            
            if matching_order.status != "open":
                continue
            
            if matching_order.id == order.id:
                continue  # Don't match order with itself
            
            if matching_order.user_id == order.user_id:
                continue  # Don't match orders from same user
            
            # Calculate fill quantity
            matching_remaining = matching_order.quantity - matching_order.filled_quantity
            fill_quantity = min(remaining, matching_remaining)
            
            if fill_quantity <= 0:
                continue
            
            # Determine trade price
            # For limit orders: use matching order's price (price-time priority)
            # For market orders: use matching order's price (best available price)
            trade_price = matching_order.price
            
            # If matching order is also a market order (shouldn't happen, but safety check)
            if trade_price is None:
                # Fallback: use the other order's price if it exists
                trade_price = order.price
                if trade_price is None:
                    continue  # Skip if both are market orders without price (invalid state)
            
            # Determine buy_order_id and sell_order_id
            if order.side == "buy":
                buy_order_id = order.id
                sell_order_id = matching_order.id
            else:
                buy_order_id = matching_order.id
                sell_order_id = order.id
            
            # Create Trade record
            trade = Trade(
                buy_order_id=buy_order_id,
                sell_order_id=sell_order_id,
                symbol=order.symbol,
                price=trade_price,
                quantity=fill_quantity,
                executed_at=datetime.utcnow()
            )
            
            self.db.add(trade)
            
            # Update current order
            order.filled_quantity += fill_quantity
            if order.filled_quantity >= order.quantity:
                order.status = "filled"
            
            # Update matching order
            matching_order.filled_quantity += fill_quantity
            if matching_order.filled_quantity >= matching_order.quantity:
                matching_order.status = "filled"
            
            # Commit the trade and order updates
            self.db.commit()
            
            # Refresh to get the trade with ID
            self.db.refresh(trade)
            trades.append(trade)
            
            # Update remaining quantity
            remaining = order.quantity - order.filled_quantity
        
        # Final commit for order status
        if order.status == "filled":
            self.db.commit()
        
        return trades
    
    def _find_matching_sell_orders(self, buy_order: Order) -> List[Order]:
        """
        Find matching sell orders for a buy order
        
        Args:
            buy_order: Buy order to match
        
        Returns:
            List of matching sell orders sorted by best price (lowest first)
        """
        if buy_order.price is None:
            # Market order - match with any sell order, sorted by best price (lowest first)
            matching_orders = self.db.query(Order).filter(
                and_(
                    Order.symbol == buy_order.symbol,
                    Order.side == "sell",
                    Order.status == "open",
                    Order.id != buy_order.id,
                    Order.user_id != buy_order.user_id,
                    Order.price.isnot(None)  # Only match with limit orders (have price)
                )
            ).order_by(Order.price.asc(), Order.created_at.asc()).all()
        else:
            # Limit order - match with sells where sell_price <= buy_price
            # Sort by best price first (lowest), then by time (FIFO)
            matching_orders = self.db.query(Order).filter(
                and_(
                    Order.symbol == buy_order.symbol,
                    Order.side == "sell",
                    Order.status == "open",
                    Order.price <= buy_order.price,
                    Order.id != buy_order.id,
                    Order.user_id != buy_order.user_id,
                    Order.price.isnot(None)
                )
            ).order_by(Order.price.asc(), Order.created_at.asc()).all()
        
        # Filter out orders with no remaining quantity
        return [
            order for order in matching_orders
            if (order.quantity - order.filled_quantity) > 0
        ]
    
    def _find_matching_buy_orders(self, sell_order: Order) -> List[Order]:
        """
        Find matching buy orders for a sell order
        
        Args:
            sell_order: Sell order to match
        
        Returns:
            List of matching buy orders sorted by best price (highest first)
        """
        if sell_order.price is None:
            # Market order - match with any buy order, sorted by best price (highest first)
            matching_orders = self.db.query(Order).filter(
                and_(
                    Order.symbol == sell_order.symbol,
                    Order.side == "buy",
                    Order.status == "open",
                    Order.id != sell_order.id,
                    Order.user_id != sell_order.user_id,
                    Order.price.isnot(None)  # Only match with limit orders (have price)
                )
            ).order_by(Order.price.desc(), Order.created_at.asc()).all()
        else:
            # Limit order - match with buys where buy_price >= sell_price
            # Sort by best price first (highest), then by time (FIFO)
            matching_orders = self.db.query(Order).filter(
                and_(
                    Order.symbol == sell_order.symbol,
                    Order.side == "buy",
                    Order.status == "open",
                    Order.price >= sell_order.price,
                    Order.id != sell_order.id,
                    Order.user_id != sell_order.user_id,
                    Order.price.isnot(None)
                )
            ).order_by(Order.price.desc(), Order.created_at.asc()).all()
        
        # Filter out orders with no remaining quantity
        return [
            order for order in matching_orders
            if (order.quantity - order.filled_quantity) > 0
        ]
