# Seed script — Phase 1B. Populates cocktails.db with dummy data.
# Run once: python seed.py

# from app import app, db
# from models import Cocktail
#
# with app.app_context():
#     db.create_all()
#     cocktails = [
#         Cocktail(name='Negroni', tags='gin,bitter,classic', colour='#c0392b',
#                  description='Bitter, bold, and timeless.', ingredients='["Gin","Campari","Sweet Vermouth"]'),
#     ]
#     db.session.add_all(cocktails)
#     db.session.commit()
#     print(f'Seeded {len(cocktails)} cocktails.')
