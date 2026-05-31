# SQLAlchemy Cocktail model — Phase 1B.
# Stub until DB is wired up. Tags stored as CSV; replaceable with many-to-many in Phase 2.

# from flask_sqlalchemy import SQLAlchemy
# db = SQLAlchemy()
#
# class Cocktail(db.Model):
#     id          = db.Column(db.Integer, primary_key=True)
#     name        = db.Column(db.String(80), nullable=False)
#     description = db.Column(db.String(200))
#     tags        = db.Column(db.String(200))  # CSV: 'vodka,fruity,classic'
#     ingredients = db.Column(db.Text)         # JSON array of ingredient names
#     colour      = db.Column(db.String(20))   # Hex colour for placeholder animation
