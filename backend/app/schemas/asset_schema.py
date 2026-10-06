"""Asset and Inventory validation schemas."""
from marshmallow import Schema, fields, validate

from app.models.enums import AssetCondition, AssetStatus


class AssetCreateSchema(Schema):
    inventory_code = fields.String(required=True, validate=validate.Length(min=3, max=50))
    category_id = fields.Integer(required=True)
    location_id = fields.Integer(allow_none=True, required=False)
    owner_unit_id = fields.Integer(allow_none=True, required=False)
    name = fields.String(required=True, validate=validate.Length(min=2, max=200))
    brand = fields.String(allow_none=True, required=False, validate=validate.Length(max=100))
    model = fields.String(allow_none=True, required=False, validate=validate.Length(max=100))
    serial_number = fields.String(allow_none=True, required=False, validate=validate.Length(max=150))
    description = fields.String(allow_none=True, required=False)
    photo_path = fields.String(allow_none=True, required=False, validate=validate.Length(max=500))
    purchase_date = fields.Date(allow_none=True, required=False)
    acquisition_cost = fields.Decimal(allow_none=True, required=False, validate=validate.Range(min=0))
    status = fields.String(
        required=False,
        validate=validate.OneOf([s.value for s in AssetStatus]),
        load_default=AssetStatus.TERSEDIA.value,
    )
    condition = fields.String(
        required=False,
        validate=validate.OneOf([c.value for c in AssetCondition]),
        load_default=AssetCondition.BAIK.value,
    )
    is_active = fields.Boolean(required=False, load_default=True)


class AssetUpdateSchema(Schema):
    category_id = fields.Integer(required=False)
    location_id = fields.Integer(allow_none=True, required=False)
    owner_unit_id = fields.Integer(allow_none=True, required=False)
    name = fields.String(required=False, validate=validate.Length(min=2, max=200))
    brand = fields.String(allow_none=True, required=False, validate=validate.Length(max=100))
    model = fields.String(allow_none=True, required=False, validate=validate.Length(max=100))
    serial_number = fields.String(allow_none=True, required=False, validate=validate.Length(max=150))
    description = fields.String(allow_none=True, required=False)
    photo_path = fields.String(allow_none=True, required=False, validate=validate.Length(max=500))
    purchase_date = fields.Date(allow_none=True, required=False)
    acquisition_cost = fields.Decimal(allow_none=True, required=False, validate=validate.Range(min=0))
    condition = fields.String(
        required=False,
        validate=validate.OneOf([c.value for c in AssetCondition]),
    )
    is_active = fields.Boolean(required=False)
    reason = fields.String(allow_none=True, required=False)
