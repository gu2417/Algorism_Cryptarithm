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

    def test_summary_captures_real_solution_after_full_trace_limit(self):
        run = self.client(TRACE_LIMIT=2).post('/api/solve', json={'expression':'A + A = A', 'algorithm':'backtracking'}).get_json()['runs'][0]
        self.assertTrue(run['trace_truncated'])
        self.assertEqual(len(run['trace']), 2)
        summary = run['summary_trace']
        self.assertEqual(run['status'], 'complete')
        self.assertTrue(any(event['type'] == 'solution' and event['assignment'] == {'A': 0} for event in summary))
        self.assertEqual(summary[-1]['type'], 'finish')
        self.assertEqual([event['seq'] for event in summary], sorted(set(event['seq'] for event in summary)))

    def test_default_example_backtracking_trace_reaches_solution_without_truncation(self):
        run = self.client().post('/api/solve', json={'expression':'SEND + MORE = MONEY', 'algorithm':'backtracking'}).get_json()['runs'][0]
        self.assertEqual(run['status'], 'complete')
        self.assertFalse(run['trace_truncated'])
        self.assertTrue(any(event['type'] == 'solution' for event in run['trace']))
        self.assertEqual(run['trace'][-1]['type'], 'finish')
        self.assertLessEqual(len(run['summary_trace']), 128)
        self.assertGreaterEqual(len(run['summary_sections']), 4)
        for section in run['summary_sections']:
            scene = [event for event in run['summary_trace'] if section['start_seq'] <= event['seq'] <= section['end_seq']]
            self.assertEqual([event['seq'] for event in scene], list(range(section['start_seq'],section['end_seq']+1)))
            self.assertGreaterEqual(len(scene),1)
        self.assertTrue(all(run['trace'][event['seq']] == event for event in run['summary_trace']))
        self.assertTrue(any(event['type'] == 'solution' for event in run['summary_trace']))
        self.assertEqual(run['summary_trace'][-1]['type'], 'finish')

    def test_summary_never_invents_finish_after_time_limit(self):
        run = self.client(TIME_LIMIT_SECONDS=0).post('/api/solve', json={'expression':'A + B = C', 'algorithm':'backtracking'}).get_json()['runs'][0]
        self.assertEqual(run['status'], 'time_limit')
        self.assertFalse(any(event['type'] in ('solution', 'finish') for event in run['summary_trace']))

    def test_brute_force_finds_send_more_before_default_timeout(self):
        run = self.client().post('/api/solve', json={'expression':'SEND + MORE = MONEY', 'algorithm':'brute_force'}).get_json()['runs'][0]
        self.assertTrue(any(solution['numeric_expression'] == '9567 + 1085 = 10652' for solution in run['solutions']))
        self.assertTrue(any(event['type'] == 'solution' for event in run['summary_trace']))
        self.assertEqual(run['status'], 'complete')
        self.assertEqual(run['statistics']['complete_assignments_checked'], 1451520)
        from Feature.trace_archive import TraceArchive
        from Module.validation import parse_expression
        archive = TraceArchive(parse_expression('SEND + MORE = MONEY'),run)
        self.assertEqual(archive.total,7748195)
        self.assertEqual(archive.page(80000,1)[0]['seq'],80000)
        self.assertEqual(archive.page(archive.total-1,1)[0]['type'],'finish')

    def test_summary_response_defers_full_trace_until_requested(self):
        client = self.client()
        payload = {'expression': 'I + BB = ILL', 'algorithm': 'backtracking', 'trace_view': 'summary'}
        response = client.post('/api/solve', json=payload)
        self.assertLess(len(response.data), 40000)
        run = response.get_json()['runs'][0]
        self.assertEqual(run['trace'], [])
        self.assertEqual(run['trace_total'], 879)
        full = client.get('/api/traces/' + run['trace_token']).get_json()['trace']
        self.assertEqual(len(full), 879)
        self.assertEqual(full[-1]['type'], 'finish')
        self.assertTrue(all(full[event['seq']] == event for event in run['summary_trace']))

    def test_optimized_brute_subtree_preserves_solutions_counters_and_event_count(self):
        payload = {'expression':'I + BB = ILL','algorithm':'brute_force'}
        detailed = self.client(TRACE_LIMIT=10000).post('/api/solve',json=payload).get_json()['runs'][0]
        limited = self.client(TRACE_LIMIT=2).post('/api/solve',json=payload).get_json()['runs'][0]
        self.assertEqual(limited['solutions'], detailed['solutions'])
        self.assertEqual(limited['events_seen'], len(detailed['trace']))
        for key in ('assignment_attempts','complete_assignments_checked','prunes'):
            self.assertEqual(limited['statistics'][key], detailed['statistics'][key])
        self.assertTrue(all(detailed['trace'][event['seq']] == event for event in limited['summary_trace']))

    def test_trace_store_is_bounded_and_unknown_tokens_fail_clearly(self):
        client = self.client()
        tokens = [client.post('/api/solve', json={'expression':'A + A = A','algorithm':'backtracking','trace_view':'summary'}).get_json()['runs'][0]['trace_token'] for _ in range(5)]
        self.assertEqual(client.get('/api/traces/' + tokens[0]).status_code, 404)
        self.assertEqual(client.get('/api/traces/' + tokens[-1]).status_code, 200)
        self.assertEqual(client.get('/api/traces/unknown').get_json()['error']['code'], 'TRACE_EXPIRED')

    def test_expired_trace_is_removed(self):
        app = create_app({'TESTING':True})
        store = app.extensions['trace_store']
        token = store.put([{'seq':0}])
        store.ttl = -1
        self.assertEqual(app.test_client().get('/api/traces/'+token).status_code,404)
        self.assertNotIn(token,store.items)

    def test_no_solution_is_complete(self):
        response = self.client().post('/api/solve', json={
            'expression': 'A + B = AA', 'algorithm': 'backtracking'})
        run = response.get_json()['runs'][0]
        self.assertEqual((run['status'], run['solutions_found']), ('complete', 0))


if __name__ == '__main__':
    unittest.main()
