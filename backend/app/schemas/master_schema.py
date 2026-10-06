"""Master data validation schemas."""
from marshmallow import Schema, fields, validate


class OrganizationalUnitSchema(Schema):
    code = fields.String(required=True, validate=validate.Length(min=2, max=50))
    name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    parent_id = fields.Integer(allow_none=True, required=False)
    description = fields.String(allow_none=True, required=False)
    is_active = fields.Boolean(required=False)


class CategorySchema(Schema):
    code = fields.String(required=True, validate=validate.Length(min=2, max=50))
    name = fields.String(required=True, validate=validate.Length(min=2, max=100))
    description = fields.String(allow_none=True, required=False)
    is_active = fields.Boolean(required=False)


class LocationSchema(Schema):
    code = fields.String(required=True, validate=validate.Length(min=2, max=50))
    name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    parent_id = fields.Integer(allow_none=True, required=False)
    description = fields.String(allow_none=True, required=False)
    is_active = fields.Boolean(required=False)


class BorrowerSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    identity_number = fields.String(allow_none=True, required=False, validate=validate.Length(max=100))
    email = fields.Email(allow_none=True, required=False)
    phone = fields.String(allow_none=True, required=False, validate=validate.Length(max=30))
    position = fields.String(allow_none=True, required=False, validate=validate.Length(max=100))
    unit_id = fields.Integer(allow_none=True, required=False)
    is_active = fields.Boolean(required=False)
