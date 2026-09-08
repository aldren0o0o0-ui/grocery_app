from concurrent.futures import ThreadPoolExecutor
from datetime import date
import pytest

from app.common.sequences import DocumentSequence, SequenceService
from app.extensions import db


@pytest.fixture(autouse=True)
def cleanup_sequences(app):
    with app.app_context():
        DocumentSequence.query.delete()
        db.session.commit()
    yield
    with app.app_context():
        DocumentSequence.query.delete()
        db.session.commit()


def test_concurrent_sequence_generation(app):
    """Verifies concurrency safety of SequenceService across PUR, SAL, and RET prefixes."""
    today = date.today()
    date_str = today.strftime("%Y%m%d")
    num_threads = 12

    for doc_type in ["PUR", "SAL", "RET"]:
        def get_seq(_):
            with app.app_context():
                ref = SequenceService.next_reference(doc_type, today)
                db.session.commit()
                return ref

        with ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(get_seq, range(num_threads)))

        # Assert no duplicates
        assert len(results) == num_threads
        assert len(set(results)) == num_threads

        # Assert correct formatting
        for ref in results:
            assert ref.startswith(f"{doc_type}-{date_str}-")

        # Assert all numbers from 1 to num_threads are present (no gaps)
        suffixes = sorted([int(ref.split("-")[-1]) for ref in results])
        assert suffixes == list(range(1, num_threads + 1))
