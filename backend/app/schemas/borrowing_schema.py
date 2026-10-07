"""Borrowing transaction validation schemas."""
from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class BorrowingCreateSchema(Schema):
    borrower_id = fields.Integer(required=True)
    start_date = fields.Date(required=True)
    due_date = fields.Date(required=True)
    purpose = fields.String(allow_none=True, required=False, validate=validate.Length(max=255))
    notes = fields.String(allow_none=True, required=False)
    asset_ids = fields.List(fields.Integer(), required=True, validate=validate.Length(min=1, max=50))
    # False -> simpan sebagai DRAF (barang belum diserahkan); True (bawaan) -> langsung checkout.
    checkout = fields.Boolean(required=False, load_default=True)

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if "due_date" in data and "start_date" in data and data["due_date"] < data["start_date"]:
            raise ValidationError("due_date harus sama dengan atau setelah start_date", "due_date")


class BorrowingCancelSchema(Schema):
    reason = fields.String(required=True, validate=validate.Length(min=3, max=500))
