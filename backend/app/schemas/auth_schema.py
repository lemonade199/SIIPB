"""Authentication request validation schemas."""
from marshmallow import Schema, fields, validate


class LoginSchema(Schema):
    username = fields.String(required=True, validate=validate.Length(min=3, max=100))
    password = fields.String(required=True, validate=validate.Length(min=4, max=100))


class RefreshTokenSchema(Schema):
    refresh_token = fields.String(required=True, validate=validate.Length(min=10))


class UserCreateSchema(Schema):
    username = fields.String(required=True, validate=validate.Length(min=3, max=100))
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=6, max=100))
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    unit_id = fields.Integer(allow_none=True)
    role_ids = fields.List(fields.Integer(), required=False)


class UserUpdateSchema(Schema):
    email = fields.Email(required=False)
    full_name = fields.String(required=False, validate=validate.Length(min=2, max=150))
    unit_id = fields.Integer(allow_none=True, required=False)
    is_active = fields.Boolean(required=False)
    role_ids = fields.List(fields.Integer(), required=False)
