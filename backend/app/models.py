"""
Database Models
SQLAlchemy models for users, orders, and trades
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.orm import declarative_base
from datetime import datetime

# Create declarative base
Base = declarative_base()


class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    orders = relationship("Order", back_populates="user")


class Order(Base):
    """Order model"""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(String(10), nullable=False)  # buy or sell
    order_type = Column(String(10), nullable=False)  # limit or market
    price = Column(Float)
    quantity = Column(Float, nullable=False)
    filled_quantity = Column(Float, default=0.0)
    status = Column(String(20), default="open", index=True)  # open, filled, cancelled
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", back_populates="orders")
    buy_trades = relationship("Trade", foreign_keys="Trade.buy_order_id", back_populates="buy_order")
    sell_trades = relationship("Trade", foreign_keys="Trade.sell_order_id", back_populates="sell_order")


class Trade(Base):
    """Trade execution model"""
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    buy_order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    sell_order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    executed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    buy_order = relationship("Order", foreign_keys=[buy_order_id], back_populates="buy_trades")
    sell_order = relationship("Order", foreign_keys=[sell_order_id], back_populates="sell_trades")
