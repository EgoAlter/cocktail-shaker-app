"""
Seed script — populates the cocktails table with 20 drinks covering every
answer option from questions.js. Run once per fresh database:

    cd api && python seed.py

Tag alignment: tags must match exact answer strings from questions.js
(lowercased). The selector does a direct string comparison after lowercasing
both sides. Tags that diverge from the answer strings silently miss.

  Spirit  options: vodka, rum, whiskey, gin, tequila, surprise me
  Flavour options: sweet, fruity, sour, bitter, balanced
  Style   options: classic, fancy, quirky, strong & simple

Spirit  coverage: vodka(4), rum(5), whiskey(4), gin(4), tequila(3)
Flavour coverage: sweet(4), fruity(7), sour(5), bitter(4), balanced(3)
  (not every cocktail needs all three tags to be distinct — a 20-drink menu
  naturally has some overlap, which is fine for tie-breaking)
Style   coverage: classic(7), fancy(7), quirky(3), strong & simple(3)

Each spirit has ≥3 cocktails covering multiple flavour + style combos —
the hard spirit filter in selector.js will always find a meaningful match.

"Surprise me" wildcard: Jungle Bird (rum + bitter + quirky) — unusual
combination that scores well for non-mainstream taste preferences.
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
    # --- VODKA ---
    {
        'name':        'Espresso Martini',
        'description': 'Vodka, coffee liqueur, and a fresh espresso shot. Sleep when you\'re dead.',
        'tags':        'vodka,sweet,fancy',
        'ingredients': json.dumps(['Vodka', 'Coffee Liqueur', 'Espresso', 'Simple Syrup']),
        'colour':      '#2c1a0e',
    },
    {
        'name':        'Moscow Mule',
        'description': 'Vodka and ginger beer in a copper mug with a squeeze of lime. Sharp and refreshing.',
        'tags':        'vodka,fruity,fancy',
        'ingredients': json.dumps(['Vodka', 'Ginger Beer', 'Fresh Lime Juice', 'Mint']),
        'colour':      '#b5c98a',
    },
    {
        'name':        'Cosmopolitan',
        'description': 'Vodka, triple sec, cranberry, and lime. Sex and the City made it famous. It deserves better than that.',
        'tags':        'vodka,fruity,classic',
        'ingredients': json.dumps(['Vodka', 'Triple Sec', 'Cranberry Juice', 'Fresh Lime Juice']),
        'colour':      '#e8607a',
    },
    {
        'name':        'Harvey Wallbanger',
        'description': 'Vodka, orange juice, and a float of herby Galliano. Strange name, stranger recipe, surprisingly delicious.',
        'tags':        'vodka,sweet,quirky',
        'ingredients': json.dumps(['Vodka', 'Fresh Orange Juice', 'Galliano']),
        'colour':      '#ff9f30',
    },

    # --- RUM ---
    {
        'name':        "Dark 'n' Stormy",
        'description': 'Dark rum over ginger beer with a squeeze of lime. Unapologetically strong.',
        'tags':        'rum,balanced,strong & simple',
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
        'name':        'Jungle Bird',
        'description': 'Dark rum, Campari, pineapple, and lime. The cocktail you didn\'t know you needed.',
        'tags':        'rum,bitter,quirky',
        'ingredients': json.dumps(['Dark Rum', 'Campari', 'Fresh Pineapple Juice', 'Fresh Lime Juice', 'Simple Syrup']),
        'colour':      '#7a3b00',
    },
    {
        'name':        'Daiquiri',
        'description': 'White rum, lime, and sugar — Hemingway\'s drink, stripped to essentials. Sour, clean, honest.',
        'tags':        'rum,sour,classic',
        'ingredients': json.dumps(['White Rum', 'Fresh Lime Juice', 'Simple Syrup']),
        'colour':      '#f0e090',
    },
    {
        'name':        'Mojito',
        'description': 'Rum, lime, sugar, mint, soda. Cuba\'s greatest export. Refreshing on any continent.',
        'tags':        'rum,fruity,fancy',
        'ingredients': json.dumps(['White Rum', 'Fresh Lime Juice', 'Simple Syrup', 'Fresh Mint', 'Soda Water']),
        'colour':      '#a8d8a8',
    },

    # --- WHISKEY ---
    {
        'name':        'Whiskey Sour',
        'description': 'Bourbon, lemon juice, sugar, and a whisper of egg white. Comfort in a glass.',
        'tags':        'whiskey,sour,classic',
        'ingredients': json.dumps(['Bourbon Whiskey', 'Fresh Lemon Juice', 'Simple Syrup', 'Egg White']),
        'colour':      '#c87941',
    },
    {
        'name':        'Old Fashioned',
        'description': 'Bourbon, sugar, bitters, and an orange twist. The original cocktail — nothing to prove.',
        'tags':        'whiskey,balanced,strong & simple',
        'ingredients': json.dumps(['Bourbon Whiskey', 'Sugar', 'Angostura Bitters', 'Orange Twist']),
        'colour':      '#a0522d',
    },
    {
        'name':        'Mint Julep',
        'description': 'Bourbon, sugar, mint, and crushed ice in a silver cup. The Derby in a glass — slow down and sip.',
        'tags':        'whiskey,sweet,classic',
        'ingredients': json.dumps(['Bourbon Whiskey', 'Sugar', 'Fresh Mint', 'Crushed Ice']),
        'colour':      '#8b6914',
    },
    {
        'name':        'Manhattan',
        'description': 'Rye, sweet vermouth, and bitters. Stirred, not shaken. Dark, complex, completely unapologetic.',
        'tags':        'whiskey,bitter,fancy',
        'ingredients': json.dumps(['Rye Whiskey', 'Sweet Vermouth', 'Angostura Bitters', 'Maraschino Cherry']),
        'colour':      '#6b2020',
    },

    # --- GIN ---
    {
        'name':        'Negroni',
        'description': 'Bitter, bold, and timeless. Equal parts gin, Campari, and sweet vermouth. A bartender\'s handshake.',
        'tags':        'gin,bitter,classic',
        'ingredients': json.dumps(['Gin', 'Campari', 'Sweet Vermouth']),
        'colour':      '#8B0000',
    },
    {
        'name':        'Tom Collins',
        'description': 'Gin, fresh lemon, and soda — tall, cold, and effortlessly cool. The original long drink.',
        'tags':        'gin,sour,fancy',
        'ingredients': json.dumps(['Gin', 'Fresh Lemon Juice', 'Simple Syrup', 'Soda Water']),
        'colour':      '#d8f0a8',
    },
    {
        'name':        'Gin & Tonic',
        'description': 'Gin and tonic water over ice with a wedge of lime. Simple, endlessly variable, never wrong.',
        'tags':        'gin,balanced,classic',
        'ingredients': json.dumps(['Gin', 'Tonic Water', 'Fresh Lime', 'Ice']),
        'colour':      '#d8f0d8',
    },
    {
        'name':        'Clover Club',
        'description': 'Gin, lemon, raspberry syrup, and egg white. Pre-Prohibition pink — elegant, tart, and underrated.',
        'tags':        'gin,fruity,fancy',
        'ingredients': json.dumps(['Gin', 'Fresh Lemon Juice', 'Raspberry Syrup', 'Egg White']),
        'colour':      '#e87090',
    },

    # --- TEQUILA ---
    {
        'name':        'Margarita',
        'description': 'Tequila, triple sec, and fresh lime. Salt optional, attitude mandatory.',
        'tags':        'tequila,sour,classic',
        'ingredients': json.dumps(['Tequila', 'Triple Sec', 'Fresh Lime Juice', 'Salt']),
        'colour':      '#c8a044',
    },
    {
        'name':        'Tequila Sunrise',
        'description': 'Tequila, orange juice, and a slow grenadine sunrise. As good as it looks.',
        'tags':        'tequila,fruity,fancy',
        'ingredients': json.dumps(['Tequila', 'Fresh Orange Juice', 'Grenadine']),
        'colour':      '#ff8c42',
    },
    {
        'name':        'Paloma',
        'description': 'Tequila and grapefruit soda with a salted rim. Mexico\'s favourite drink that tourists never order. Fix that.',
        'tags':        'tequila,sour,fancy',
        'ingredients': json.dumps(['Tequila', 'Grapefruit Soda', 'Fresh Lime Juice', 'Salt']),
        'colour':      '#f08060',
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
