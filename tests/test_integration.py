import unittest
from app import create_app
from Core.constraints import is_solution
from Module.validation import parse_expression


class IntegrationTests(unittest.TestCase):
    def test_examples_trace_and_result_agree(self):
        client = create_app({'TESTING': True}).test_client()
        for expression in ('I + BB = ILL', 'SEND + MORE = MONEY'):
            with self.subTest(expression=expression):
                run = client.post('/api/solve', json={'expression':expression,'algorithm':'backtracking'}).get_json()['runs'][0]
                self.assertEqual(run['status'], 'complete')
                self.assertTrue(run['solutions'])
                problem = parse_expression(expression)
                for solution in run['solutions']:
                    self.assertTrue(is_solution(problem, solution['mapping']))
                self.assertEqual([e['seq'] for e in run['trace']], list(range(len(run['trace']))))
                for event in run['trace']:
                    self.assertEqual(len(event['assignment'].values()), len(set(event['assignment'].values())))
                    if event['is_solution']:
                        self.assertTrue(is_solution(problem,event['assignment']))

    def test_actual_deadline_interrupts_nontrivial_search(self):
        client = create_app({'TESTING':True,'TIME_LIMIT_SECONDS':0.02}).test_client()
        run = client.post('/api/solve',json={'expression':'SEND + MORE = MONEY','algorithm':'brute_force'}).get_json()['runs'][0]
        self.assertEqual(run['status'],'time_limit')
        self.assertGreater(run['statistics']['assignment_attempts'],0)
        self.assertGreaterEqual(run['statistics']['elapsed_ms'],20)
        # Broad tolerance: cooperative checks do not promise a hard real-time deadline.
        self.assertLess(run['statistics']['elapsed_ms'],2000)

    def test_requests_do_not_retain_previous_solutions(self):
        client=create_app({'TESTING':True}).test_client()
        first=client.post('/api/solve',json={'expression':'A + B = C','algorithm':'backtracking'}).get_json()['runs'][0]
        second=client.post('/api/solve',json={'expression':'A + B = AA','algorithm':'backtracking'}).get_json()['runs'][0]
        self.assertGreater(first['solutions_found'],0)
        self.assertEqual(second['solutions_found'],0)


if __name__=='__main__':
    unittest.main()
