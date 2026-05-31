import os
from flask import Flask, jsonify
from flask_cors import CORS
from models import db, Cocktail

# Load .env file when present (local dev). No-op in production where env vars
# are set by the platform (Render, Supabase, etc.).
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
CORS(app)

# DATABASE_URL is the Postgres connection string (Supabase or Render).
# Falls back to local SQLite for development without a configured database.
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Render sometimes returns 'postgres://' which SQLAlchemy 2.0 requires as 'postgresql://'
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "cocktails.db")}'
    print('WARNING: DATABASE_URL not set — using local SQLite. Set DATABASE_URL to your Supabase connection string for persistent storage.')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/cocktails')
def get_cocktails():
    cocktails = db.session.execute(db.select(Cocktail)).scalars().all()
    return jsonify([c.to_dict() for c in cocktails])


@app.route('/api/cocktails/<int:cocktail_id>')
def get_cocktail(cocktail_id):
    cocktail = db.session.get(Cocktail, cocktail_id)
    if cocktail is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify(cocktail.to_dict())


if __name__ == '__main__':
    app.run(port=5001, debug=True)
