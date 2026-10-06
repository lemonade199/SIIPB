"""Return transaction validation schemas."""
from marshmallow import Schema, fields, validate

from app.models.enums import DamageSeverity, ReturnCondition


class DamageInputSchema(Schema):
    severity = fields.String(
        required=True,
        validate=validate.OneOf([s.value for s in DamageSeverity]),
    )
    description = fields.String(required=True, validate=validate.Length(min=3))
    evidence_path = fields.String(allow_none=True, required=False)
    action_taken = fields.String(allow_none=True, required=False)
    repair_cost = fields.Decimal(allow_none=True, required=False, validate=validate.Range(min=0))


class LossInputSchema(Schema):
    description = fields.String(required=True, validate=validate.Length(min=3))
    evidence_path = fields.String(allow_none=True, required=False)
    action_taken = fields.String(allow_none=True, required=False)


class ReturnItemInputSchema(Schema):
    borrowing_item_id = fields.Integer(required=True)
    asset_id = fields.Integer(required=True)
    final_condition = fields.String(
        required=True,
        validate=validate.OneOf([c.value for c in ReturnCondition]),
    )
    completeness = fields.String(allow_none=True, required=False)
    notes = fields.String(allow_none=True, required=False)
    damage = fields.Nested(DamageInputSchema, required=False)
    loss = fields.Nested(LossInputSchema, required=False)


class ReturnCreateSchema(Schema):
    borrowing_id = fields.Integer(required=True)
    notes = fields.String(allow_none=True, required=False)
    items = fields.List(
        fields.Nested(ReturnItemInputSchema),
        required=True,
        validate=validate.Length(min=1),
    )
