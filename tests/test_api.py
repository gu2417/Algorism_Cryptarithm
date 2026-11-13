import unittest
from app import create_app


class ApiTests(unittest.TestCase):
    def client(self, **config):
        app = create_app({'TESTING': True, **config})
        return app.test_client()

    def test_compare_returns_matching_solutions_and_stats(self):
        response = self.client().post('/api/solve', json={'expression': 'a + a = a', 'algorithm': 'compare'})
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body['normalized_expression'], 'A + A = A')
        self.assertEqual(len(body['runs']), 2)
        for run in body['runs']:
            self.assertEqual(run['status'], 'complete')
            self.assertEqual(run['solutions_found'], 1)
            self.assertEqual(run['solutions'][0]['mapping'], {'A': 0})
            self.assertEqual(run['solutions'][0]['numeric_expression'], '0 + 0 = 0')
            self.assertGreater(run['statistics']['assignment_attempts'], 0)
        self.assertTrue(body['runs'][0]['trace'])
        self.assertTrue(body['runs'][1]['trace'])

    def test_bad_request(self):
        client = self.client()
        for payload, code in [({'expression': '', 'algorithm': 'backtracking'}, 'EMPTY_INPUT'),
                              ({'expression': 'A - B = C', 'algorithm': 'backtracking'}, 'INVALID_FORMAT'),
                              ({'expression': 'A + B = C', 'algorithm': 'bad'}, 'INVALID_ALGORITHM'),
                              ([], 'INVALID_FORMAT')]:
            with self.subTest(payload=payload):
                response = client.post('/api/solve', json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()['error']['code'], code)
        self.assertEqual(client.post('/api/solve', data='not json', content_type='application/json').status_code, 400)

    def test_solution_limit_and_independent_trace_limit(self):
        response = self.client(SOLUTION_LIMIT=2, TRACE_LIMIT=2).post('/api/solve', json={
            'expression': 'A + B = C', 'algorithm': 'backtracking'})
        run = response.get_json()['runs'][0]
        self.assertEqual(run['status'], 'solution_limit')
        self.assertEqual(run['solutions_found'], 2)
        self.assertEqual(len(run['trace']), 2)
        self.assertTrue(run['trace_truncated'])

    def test_trace_truncation_does_not_stop_search(self):
        response = self.client(TRACE_LIMIT=1).post('/api/solve', json={
            'expression': 'A + A = A', 'algorithm': 'backtracking'})
        run = response.get_json()['runs'][0]
        self.assertEqual(run['status'], 'complete')
        self.assertEqual(run['solutions_found'], 1)
        self.assertTrue(run['trace_truncated'])

    def test_timeout_is_partial_for_each_algorithm(self):
        response = self.client(TIME_LIMIT_SECONDS=0).post('/api/solve', json={
            'expression': 'A + B = C', 'algorithm': 'compare'})
        self.assertEqual(response.status_code, 200)
        for run in response.get_json()['runs']:
            self.assertEqual(run['status'], 'time_limit')
            self.assertEqual(run['solutions_found'], 0)

    def test_brute_force_stops_at_solution_limit(self):
        response = self.client(SOLUTION_LIMIT=2).post('/api/solve', json={
            'expression': 'A + B = C', 'algorithm': 'brute_force'})
        run = response.get_json()['runs'][0]
        self.assertEqual(run['status'], 'solution_limit')
        self.assertEqual(run['solutions_found'], 2)
        self.assertTrue(run['trace'])
        self.assertFalse(run['trace_truncated'])

    def test_brute_trace_reflects_actual_complete_checks_and_snapshots(self):
        run = self.client().post('/api/solve', json={'expression':'A + A = A', 'algorithm':'brute_force'}).get_json()['runs'][0]
        events = run['trace']
        self.assertEqual(events[0]['type'], 'start')
        self.assertEqual(events[-1]['type'], 'finish')
        self.assertEqual([event['seq'] for event in events], list(range(len(events))))
        checks = [event for event in events if event['type'] == 'complete_check']
        self.assertEqual(len(checks), run['statistics']['complete_assignments_checked'])
        self.assertTrue(any(event['is_solution'] for event in checks))
        self.assertTrue(any(not event['is_solution'] for event in checks))
        self.assertTrue(any(event['type'] == 'backtrack' and event['undo'] for event in events))
        self.assertTrue(all(event['column'] is None for event in events))

    def test_brute_trace_limit_does_not_stop_complete_search(self):
        run = self.client(TRACE_LIMIT=2).post('/api/solve', json={'expression':'A + A = A', 'algorithm':'brute_force'}).get_json()['runs'][0]
        self.assertEqual((run['status'], run['solutions_found'], len(run['trace']), run['trace_truncated']), ('complete', 1, 2, True))

    def test_compare_limits_each_trace_independently(self):
        runs = self.client(TRACE_LIMIT=2).post('/api/solve', json={'expression':'A + A = A', 'algorithm':'compare'}).get_json()['runs']
        for run in runs:
            self.assertEqual((run['status'], run['solutions_found'], len(run['trace']), run['trace_truncated']), ('complete', 1, 2, True))
            self.assertEqual([event['seq'] for event in run['trace']], [0, 1])

    def test_no_solution_is_complete(self):
        response = self.client().post('/api/solve', json={
            'expression': 'A + B = AA', 'algorithm': 'backtracking'})
        run = response.get_json()['runs'][0]
        self.assertEqual((run['status'], run['solutions_found']), ('complete', 0))


if __name__ == '__main__':
    unittest.main()
