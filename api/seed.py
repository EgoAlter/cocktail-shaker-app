"""
Seed script — populates the cocktails table with 10 drinks covering every
answer option from questions.js. Run once per fresh database:

    cd api && python seed.py

Tag spread strategy:
  Every spirit/flavour/style option from questions.js has at least one
  exact-match tag here. If a tag were missing, the selector falls back to
  partial matches and returns misleading results.

  Spirit  coverage: vodka(2), rum(3), whiskey(1), gin(2), tequila(2)
  Flavour coverage: sweet(2), fruity(3), sour(2), bitter(2), balanced(2)
  Style   coverage: classic(4), fancy(3), quirky(2), strong(1)

  Deliberate tag overlaps for selector tie-breaking tests in Phase 1C:
    - Margarita and Whiskey Sour both have (sour, classic) — spirit is the tiebreaker
    - Negroni and Gin & Tonic both have (gin, classic) — flavour is the tiebreaker
    - Moscow Mule and Tequila Sunrise both have (fruity, fancy) — spirit is the tiebreaker

  "Surprise me" handling: Jungle Bird is the oddball pick (rum + bitter + quirky).
  The selector in Phase 1C maps the "Surprise me" spirit answer to a random
  or low-match cocktail; Jungle Bird fits naturally.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from app import app
from models import db, Cocktail

COCKTAILS = [
    {
        'name':        'Negroni',
        'description': 'Bitter, bold, and timeless. Equal parts gin, Campari, and sweet vermouth. A bartender\'s handshake.',
        'tags':        'gin,bitter,classic',
        'ingredients': json.dumps(['Gin', 'Campari', 'Sweet Vermouth']),
        'colour':      '#8B0000',
    },
    {
        'name':        'Margarita',
        'description': 'Tequila, triple sec, and fresh lime. Salt optional, attitude mandatory.',
        'tags':        'tequila,sour,classic',
        'ingredients': json.dumps(['Tequila', 'Triple Sec', 'Fresh Lime Juice', 'Salt']),
        'colour':      '#c8a044',
    },
    {
        'name':        'Espresso Martini',
        'description': 'Vodka, coffee liqueur, and a fresh espresso shot. Sleep when you\'re dead.',
        'tags':        'vodka,sweet,fancy',
        'ingredients': json.dumps(['Vodka', 'Coffee Liqueur', 'Espresso', 'Simple Syrup']),
        'colour':      '#2c1a0e',
    },
    {
        'name':        'Whiskey Sour',
        'description': 'Bourbon, lemon juice, sugar, and a whisper of egg white. Comfort in a glass.',
        'tags':        'whiskey,sour,classic',
        'ingredients': json.dumps(['Bourbon Whiskey', 'Fresh Lemon Juice', 'Simple Syrup', 'Egg White']),
        'colour':      '#c87941',
    },
    {
        'name':        "Dark 'n' Stormy",
        'description': 'Dark rum over ginger beer with a squeeze of lime. Unapologetically strong.',
        'tags':        'rum,balanced,strong',
        'ingredients': json.dumps(['Dark Rum', 'Ginger Beer', 'Fresh Lime']),
        'colour':      '#1c0a00',
    },
    {
        'name':        'Piña Colada',
        'description': 'Rum, coconut cream, and fresh pineapple. Close your eyes and you\'re somewhere warmer.',
        'tags':        'rum,fruity,quirky',
        'ingredients': json.dumps(['White Rum', 'Coconut Cream', 'Fresh Pineapple Juice']),
        'colour':      '#f5e6b0',
    },
    {
        'name':        'Moscow Mule',
        'description': 'Vodka and ginger beer in a copper mug with a squeeze of lime. Sharp and refreshing.',
        'tags':        'vodka,fruity,fancy',
        'ingredients': json.dumps(['Vodka', 'Ginger Beer', 'Fresh Lime Juice', 'Mint']),
        'colour':      '#b5c98a',
    },
    {
        'name':        'Gin & Tonic',
        'description': 'Gin and tonic water over ice with a wedge of lime. Simple, endlessly variable, never wrong.',
        'tags':        'gin,balanced,classic',
        'ingredients': json.dumps(['Gin', 'Tonic Water', 'Fresh Lime', 'Ice']),
        'colour':      '#d8f0d8',
    },
    {
        'name':        'Tequila Sunrise',
        'description': 'Tequila, orange juice, and a slow grenadine sunrise. As good as it looks.',
        'tags':        'tequila,fruity,fancy',
        'ingredients': json.dumps(['Tequila', 'Fresh Orange Juice', 'Grenadine']),
        'colour':      '#ff8c42',
    },
    {
        'name':        'Jungle Bird',
        'description': 'Dark rum, Campari, pineapple, and lime. The cocktail you didn\'t know you needed.',
        'tags':        'rum,bitter,quirky',
        'ingredients': json.dumps(['Dark Rum', 'Campari', 'Fresh Pineapple Juice', 'Fresh Lime Juice', 'Simple Syrup']),
        'colour':      '#7a3b00',
    },
]


def seed():
    with app.app_context():
        db.create_all()
        existing = db.session.execute(db.select(Cocktail)).scalars().all()
        if existing:
            print(f'Database already has {len(existing)} cocktails. Clearing and re-seeding.')
            db.session.execute(db.delete(Cocktail))
            db.session.commit()

        for data in COCKTAILS:
            db.session.add(Cocktail(**data))
        db.session.commit()

        count = db.session.execute(db.select(db.func.count()).select_from(Cocktail)).scalar()
        print(f'Seeded {count} cocktails.')


if __name__ == '__main__':
    seed()
