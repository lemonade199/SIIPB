"""Borrowing transaction validation schemas."""
from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class BorrowingCreateSchema(Schema):
    borrower_id = fields.Integer(required=True)
    start_date = fields.Date(required=True)
    due_date = fields.Date(required=True)
    purpose = fields.String(allow_none=True, required=False, validate=validate.Length(max=255))
    notes = fields.String(allow_none=True, required=False)
    asset_ids = fields.List(fields.Integer(), required=True, validate=validate.Length(min=1))

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data["due_date"] < data["start_date"]:
            raise ValidationError("due_date harus sama dengan atau setelah start_date", "due_date")
