import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from models import db, Cocktail

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
# Project root — Flask serves the static frontend from here.
STATIC_DIR = os.path.normpath(os.path.join(basedir, '..'))

database_url = os.environ.get('DATABASE_URL')
if database_url:
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "cocktails.db")}'
    print('WARNING: DATABASE_URL not set — using local SQLite.')

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


@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    # Block the api/ directory — never expose Python source, .env, or the DB.
    if path.startswith('api/'):
        return jsonify({'error': 'not found'}), 404
    full = os.path.join(STATIC_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, 'index.html')


if __name__ == '__main__':
    app.run(port=5001, debug=True)
