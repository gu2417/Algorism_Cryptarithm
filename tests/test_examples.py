import unittest
from html.parser import HTMLParser

from app import create_app


class ExampleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.examples = []

    def handle_starttag(self, tag, attrs):
        value = dict(attrs).get('data-example')
        if value is not None:
            self.examples.append(value)


class ExampleTests(unittest.TestCase):
    def test_presented_examples_have_expected_solution_counts(self):
        client = create_app({'TESTING': True}).test_client()
        parser = ExampleParser()
        parser.feed(client.get('/').get_data(as_text=True))
        expected = {'I + BB = ILL': 1, 'SEND + MORE = MONEY': 1,
                    'A + A = A': 1, 'A + B = C': 32, 'A + B = AA': 0}
        self.assertEqual(set(parser.examples), set(expected))
        for expression, count in expected.items():
            with self.subTest(expression=expression):
                response = client.post('/api/solve', json={'expression': expression, 'algorithm': 'backtracking'})
                run = response.get_json()['runs'][0]
                self.assertEqual(response.status_code, 200)
                self.assertEqual((run['status'], run['solutions_found']), ('complete', count))
