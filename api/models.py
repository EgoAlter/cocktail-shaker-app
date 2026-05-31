import json
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Cocktail(db.Model):
    # Tags stored as CSV ('vodka,fruity,classic') for Phase 1 simplicity.
    # Phase 2 upgrade path: extract to Tag model + cocktail_tags association table.
    # Only to_dict() changes — API contract and selector logic remain identical.
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(200))
    tags        = db.Column(db.String(200))
    ingredients = db.Column(db.Text)   # JSON array, e.g. '["Gin","Campari"]'
    colour      = db.Column(db.String(20))

    def to_dict(self):
        return {
            'id':          self.id,
            'name':        self.name,
            'description': self.description,
            'tags':        self.tags,
            'ingredients': json.loads(self.ingredients) if self.ingredients else [],
            'colour':      self.colour,
        }
