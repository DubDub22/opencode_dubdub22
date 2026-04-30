"""Database models for DubDub22 system"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class SerialNumber(Base):
    """Serial number model"""
    __tablename__ = "serial_numbers"
    
    id = Column(Integer, primary_key=True)
    serial = Column(String(50), unique=True, nullable=False, index=True)
    status = Column(String(20), default="available", index=True)  # available, purchased, engraved, shipped, delivered
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    purchased_at = Column(DateTime, nullable=True, index=True)
    purchased_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=True, index=True)
    qr_code_path = Column(String(255), nullable=True)
    customer_portal_url = Column(String(255), nullable=True)
    fastbound_synced = Column(Boolean, default=False, index=True)
    fastbound_id = Column(String(100), nullable=True, index=True)
    manufacture_date = Column(DateTime, nullable=True, index=True)  # Date of manufacture
    revision = Column(String(10), nullable=True, index=True)  # Revision number (e.g., "Rev 4")
    
    # Composite indexes for common query patterns
    __table_args__ = (
        # Index for status + date range queries
        Index('idx_serial_status_date', 'status', 'manufacture_date'),
        # Index for purchaser + date queries
        Index('idx_serial_purchaser_date', 'purchased_by', 'purchased_at'),
        # Index for revision + date queries
        Index('idx_serial_revision_date', 'revision', 'manufacture_date'),
    )
    
    # Relationships
    purchase = relationship("Purchase", back_populates="serials")
    purchaser = relationship("User", foreign_keys=[purchased_by], back_populates="purchased_serials")
    customer = relationship("Customer", back_populates="serial_number", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="serial_number", cascade="all, delete-orphan")
    warranty_requests = relationship("WarrantyRequest", foreign_keys="WarrantyRequest.serial_number_id", back_populates="serial_number", cascade="all, delete-orphan")
    short_link = relationship("ShortLink", back_populates="serial_number", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<SerialNumber(serial='{self.serial}', status='{self.status}')>"


class User(Base):
    """User model for Eric and Tom"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(Integer, unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # licensor, manufacturer
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    purchases = relationship("Purchase", back_populates="user", cascade="all, delete-orphan")
    purchased_serials = relationship("SerialNumber", foreign_keys="SerialNumber.purchased_by", back_populates="purchaser")
    
    def __repr__(self):
        return f"<User(name='{self.name}', role='{self.role}')>"


class Purchase(Base):
    """Purchase model for serial number purchases"""
    __tablename__ = "purchases"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price_per_serial = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    payment_method = Column(String(50), nullable=False)  # stripe, paypal, etc.
    payment_id = Column(String(255), nullable=True)
    status = Column(String(20), default="pending")  # pending, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="purchases")
    serials = relationship("SerialNumber", back_populates="purchase")
    
    def __repr__(self):
        return f"<Purchase(id={self.id}, quantity={self.quantity}, status='{self.status}')>"


class Customer(Base):
    """Customer model for end users"""
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), unique=True, nullable=False)
    name = Column(String(200), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, nullable=True)
    
    # Relationships
    serial_number = relationship("SerialNumber", back_populates="customer")
    documents = relationship("Document", back_populates="customer")
    warranty_requests = relationship("WarrantyRequest", back_populates="customer", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Customer(name='{self.name}', serial_id={self.serial_number_id})>"


class Document(Base):
    """Document model for customer uploads"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    document_type = Column(String(50), nullable=False)  # trust_document, tax_stamp, other
    file_path = Column(String(255), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    serial_number = relationship("SerialNumber", back_populates="documents")
    customer = relationship("Customer", back_populates="documents")
    
    def __repr__(self):
        return f"<Document(type='{self.document_type}', file='{self.file_name}')>"


class EngravingFile(Base):
    """Engraving file model"""
    __tablename__ = "engraving_files"
    
    id = Column(Integer, primary_key=True)
    file_path = Column(String(255), nullable=False)
    file_name = Column(String(255), nullable=False)
    serial_numbers = Column(Text, nullable=False)  # JSON array of serial IDs
    jig_position = Column(Integer, nullable=True)  # Position in jig (1-9)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<EngravingFile(file='{self.file_name}')>"


class ShortLink(Base):
    """Short link model for QR codes"""
    __tablename__ = "short_links"
    
    id = Column(Integer, primary_key=True)
    short_code = Column(String(20), unique=True, nullable=False, index=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=False, unique=True)
    encrypted_token = Column(String(255), nullable=False)  # Salted encrypted token
    created_at = Column(DateTime, default=datetime.utcnow)
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)
    
    # Relationships
    serial_number = relationship("SerialNumber", back_populates="short_link")
    
    def __repr__(self):
        return f"<ShortLink(short_code='{self.short_code}', serial_id={self.serial_number_id})>"


class WarrantyRequest(Base):
    """Warranty request model"""
    __tablename__ = "warranty_requests"
    
    id = Column(Integer, primary_key=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    request_type = Column(String(50), nullable=False)  # replacement, repair, defect, other
    description = Column(Text, nullable=True)
    photo_path = Column(String(255), nullable=True)
    status = Column(String(20), default="pending")  # pending, in_review, approved, denied, fulfilled
    admin_notes = Column(Text, nullable=True)
    replacement_serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    serial_number = relationship("SerialNumber", foreign_keys=[serial_number_id], back_populates="warranty_requests")
    customer = relationship("Customer", back_populates="warranty_requests")
    replacement_serial = relationship("SerialNumber", foreign_keys=[replacement_serial_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    
    def __repr__(self):
        return f"<WarrantyRequest(id={self.id}, type='{self.request_type}', status='{self.status}')>"


class Dealer(Base):
    """Dealer/FFL holder model"""
    __tablename__ = "dealers"
    
    id = Column(Integer, primary_key=True)
    business_name = Column(String(255), nullable=False)
    contact_name = Column(String(200), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    ffl_number = Column(String(50), unique=True, nullable=False, index=True)
    ffl_type = Column(String(10), nullable=True)  # 01, 07, etc.
    ffl_verified = Column(Boolean, default=False)
    ffl_verified_at = Column(DateTime, nullable=True)
    ffl_expires = Column(DateTime, nullable=True)  # FFL expiration date
    ffl_document_path = Column(String(255), nullable=True)
    ocr_extracted_data = Column(Text, nullable=True)  # JSON of OCR results
    
    # FFL address (extracted from license)
    ffl_address = Column(String(255), nullable=True)  # Street address
    ffl_city = Column(String(100), nullable=True)
    ffl_state = Column(String(2), nullable=True)  # 2-letter state code
    ffl_zip = Column(String(20), nullable=True)
    
    # Mailing address (may differ from FFL address)
    mailing_address = Column(String(255), nullable=True)
    mailing_city = Column(String(100), nullable=True)
    mailing_state = Column(String(2), nullable=True)
    mailing_zip = Column(String(20), nullable=True)
    
    status = Column(String(20), default="pending")  # pending, active, suspended
    source = Column(String(50), nullable=True)  # atf_oasis, rebel_dealer_list, manual
    has_ordered_sample = Column(Boolean, default=False)  # Track if dealer has ordered sample
    created_at = Column(DateTime, default=datetime.utcnow)
    last_order_at = Column(DateTime, nullable=True)
    
    # Relationships
    orders = relationship("DealerOrder", back_populates="dealer")
    invoices = relationship("Invoice", back_populates="dealer")
    
    def __repr__(self):
        return f"<Dealer(business='{self.business_name}', ffl='{self.ffl_number}')>"


class DealerOrder(Base):
    """Dealer order model"""
    __tablename__ = "dealer_orders"
    
    id = Column(Integer, primary_key=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    
    # FFL document for this order (copy stored with order)
    ffl_document_path = Column(String(255), nullable=False)  # Required - FFL copy with order
    
    # Order items
    is_dealer_sample = Column(Boolean, default=False)  # $25 dealer sample
    quantity_cans = Column(Integer, default=0)
    quantity_sleeve_5packs = Column(Integer, default=0)  # Extra sleeve 5-packs (for all dealers, $100 each)
    quantity_baffle_25pack = Column(Integer, default=0)  # 25-baffle replacement set (Type 07 only, $50)
    quantity_cases = Column(Integer, default=0)  # Extra rectangular tube cases (all dealers, $10 each)
    quantity_pins = Column(Integer, default=0)  # Extra ejection/retention pins (all dealers, $10 each)
    
    # Pricing
    can_price = Column(Float, default=60.0)
    sleeve_5pack_price = Column(Float, default=100.0)
    baffle_25pack_price = Column(Float, default=50.0)
    case_price = Column(Float, default=10.0)
    pin_price = Column(Float, default=10.0)
    subtotal = Column(Float, nullable=False)
    shipping_cost = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    
    # Status
    status = Column(String(20), default="pending")  # pending, invoiced, paid, shipped, completed
    created_at = Column(DateTime, default=datetime.utcnow)
    invoiced_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    
    # Relationships
    dealer = relationship("Dealer", back_populates="orders")
    invoice = relationship("Invoice", back_populates="order", uselist=False)
    
    def __repr__(self):
        return f"<DealerOrder(order_number='{self.order_number}', total=${self.total_amount:.2f})>"


class InvoiceCounter(Base):
    """Shared sequential counter for invoice numbers"""
    __tablename__ = "invoice_counter"

    id = Column(Integer, primary_key=True)
    last_number = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Invoice(Base):
    """Invoice model"""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("dealer_orders.id"), nullable=True, unique=True)

    # Invoice type
    is_retail = Column(Boolean, default=False)  # True = retail (direct sale), False = dealer

    # Retail customer fields (for is_retail=True)
    retail_customer_name = Column(String(200), nullable=True)
    retail_customer_email = Column(String(255), nullable=True)
    retail_customer_phone = Column(String(50), nullable=True)
    retail_customer_address = Column(String(255), nullable=True)
    retail_customer_city = Column(String(100), nullable=True)
    retail_customer_state = Column(String(2), nullable=True)
    retail_customer_zip = Column(String(20), nullable=True)

    # Line items (for retail: single line; for dealer: from order)
    quantity = Column(Integer, nullable=True)  # Number of suppressors
    unit_price = Column(Float, nullable=True)  # Per-unit price ($60 dealer, $129 retail)
    subtotal = Column(Float, nullable=False)
    tax_rate = Column(Float, default=0.0825)  # 8.25%
    tax_amount = Column(Float, nullable=True)  # Calculated tax
    shipping_cost = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)

    # Status
    status = Column(String(20), default="draft")  # draft, sent, paid, overdue, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)

    # PDF
    pdf_path = Column(String(255), nullable=True)
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime, nullable=True)

    # Relationships
    dealer = relationship("Dealer", back_populates="invoices")
    order = relationship("DealerOrder", back_populates="invoice")
    
    def __repr__(self):
        return f"<Invoice(invoice_number='{self.invoice_number}', total=${self.total_amount:.2f})>"


class SystemSettings(Base):
    """System-wide settings"""
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<SystemSettings(key='{self.key}', value='{self.value}')>"



class RetailInquiry(Base):
    """Retail customer inquiry from dealer map clicks"""
    __tablename__ = "retail_inquiries"
    
    id = Column(Integer, primary_key=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False, index=True)
    contact_name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String(20), default="new")  # new, contacted, won, lost
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    dealer = relationship("Dealer", backref="retail_inquiries")
