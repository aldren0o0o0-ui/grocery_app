import pytest
from app import create_app
from app.extensions import db


@pytest.fixture(scope="session")
def app():
    app = create_app()
    app.config.update({"TESTING": True})
    return app


@pytest.fixture(scope="function")
def client(app):
    with app.app_context():
        yield app.test_client()




@pytest.fixture(scope="function")
def db_session(app):
    with app.app_context():
        connection = db.engine.connect()
        transaction = connection.begin()

        # Modern SQLAlchemy 2 / Flask-SQLAlchemy 3 session bind
        session = db.session
        session.bind = connection

        yield session

        session.rollback()
        transaction.rollback()
        connection.close()
        session.remove()
