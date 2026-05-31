from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Required: tunnel URL is a different origin from :5000

# Hardcoded dummy data — no DB yet. Replaced by SQLAlchemy + seed.py in Phase 1B.
# Tags are CSV, matching the schema in CLAUDE.md.
COCKTAILS = [
    {
        "id": 1,
        "name": "Negroni",
        "description": "Bitter, bold, and timeless. Equal parts gin, Campari, and sweet vermouth.",
        "tags": "gin,bitter,classic",
        "ingredients": ["Gin", "Campari", "Sweet Vermouth"],
        "colour": "#c0392b",
    },
    {
        "id": 2,
        "name": "Margarita",
        "description": "Tequila, lime, and a salted rim. The crowd pleaser.",
        "tags": "tequila,sour,classic",
        "ingredients": ["Tequila", "Triple Sec", "Lime Juice"],
        "colour": "#f39c12",
    },
    {
        "id": 3,
        "name": "Espresso Martini",
        "description": "Vodka, coffee liqueur, and a fresh espresso shot. Bold and sweet.",
        "tags": "vodka,sweet,fancy",
        "ingredients": ["Vodka", "Coffee Liqueur", "Espresso"],
        "colour": "#2c1a0e",
    },
]


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/cocktails")
def get_cocktails():
    return jsonify(COCKTAILS)


@app.route("/api/cocktails/<int:cocktail_id>")
def get_cocktail(cocktail_id):
    cocktail = next((c for c in COCKTAILS if c["id"] == cocktail_id), None)
    if cocktail is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(cocktail)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
