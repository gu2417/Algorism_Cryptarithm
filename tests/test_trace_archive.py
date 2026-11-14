import unittest
from app import create_app
from Module.validation import parse_expression
from Feature.solve import run
from Feature.trace_archive import TraceArchive


class ArchiveTests(unittest.TestCase):
    def test_every_reconstructed_event_matches_the_original_execution(self):
        for expression in ('A + A = A','A + B = C','I + BB = ILL','A + B = AA'):
            for algorithm in ('brute_force','backtracking'):
                with self.subTest(expression=expression,algorithm=algorithm):
                    problem=parse_expression(expression)
                    result=run(problem,algorithm,time_limit=10,solution_limit=100,trace_limit=10000)
                    expected=result['trace']
                    result['trace']=expected[:2]
                    archive=TraceArchive(problem,result)
                    actual=[]
                    for offset in range(0,archive.total,127):
                        actual.extend(archive.page(offset,127))
                    self.assertEqual(actual,expected)

    def test_partial_run_reconstructs_only_executed_events(self):
        problem=parse_expression('A + B = C')
        result=run(problem,'brute_force',time_limit=10,solution_limit=2,trace_limit=10000)
        expected=result['trace'];result['trace']=expected[:1]
        self.assertEqual(TraceArchive(problem,result).page(0,10000),expected)

    def test_api_can_reach_beyond_buffer_and_fetch_actual_finish(self):
        client=create_app({'TESTING':True,'TRACE_LIMIT':2}).test_client()
        body=client.post('/api/solve',json={'expression':'I + BB = ILL','algorithm':'brute_force','trace_view':'summary'}).get_json()
        result=body['runs'][0]
        self.assertEqual(result['trace_total'],2723)
        self.assertFalse(result['trace_truncated'])
        url='/api/traces/'+result['trace_token']
        page=client.get(url+'?offset=2700&limit=200').get_json()
        self.assertEqual(page['trace'][-1]['seq'],2722)
        self.assertEqual(page['trace'][-1]['type'],'finish')
        self.assertEqual(client.get(url+'?offset=-1&limit=200').status_code,400)
        self.assertEqual(client.get(url+'?offset=0&limit=99999').status_code,400)
