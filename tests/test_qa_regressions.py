import unittest
from app import create_app


class FinalQARegressionTests(unittest.TestCase):
    # Regression: QA-01/02, found during the 2026-11-14 full browser inspection.
    def test_no_solution_explanation_does_not_claim_a_solution_was_found(self):
        result=create_app({'TESTING':True}).test_client().post('/api/solve',json={'expression':'A + B = AA','algorithm':'backtracking','trace_view':'summary'}).get_json()['runs'][0]
        self.assertEqual(result['solutions_found'],0)
        self.assertNotIn('정답을 찾은 뒤',result['presentation_scenes'][-1]['explanation'])

    def test_brute_solution_explanation_describes_whole_equation_validation(self):
        result=create_app({'TESTING':True}).test_client().post('/api/solve',json={'expression':'I + BB = ILL','algorithm':'brute_force','trace_view':'summary'}).get_json()['runs'][0]
        scene=next(scene for scene in result['presentation_scenes'] if scene['phase']=='정답')
        self.assertNotIn('모든 자리의 계산',scene['explanation'])
        self.assertNotIn('마지막 올림',scene['explanation'])
        self.assertIn('전체 식',scene['explanation'])
