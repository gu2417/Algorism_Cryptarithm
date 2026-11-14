import unittest
from app import create_app


class PresentationTests(unittest.TestCase):
    def test_scenes_use_actual_snapshots_and_explain_real_column_math(self):
        client=create_app({'TESTING':True,'TRACE_LIMIT':2,'TIME_LIMIT_SECONDS':15}).test_client()
        for expression in ('I + BB = ILL','SEND + MORE = MONEY','A + A = A','A + B = C','A + B = AA'):
            for algorithm in ('backtracking','brute_force'):
                with self.subTest(expression=expression,algorithm=algorithm):
                    result=client.post('/api/solve',json={'expression':expression,'algorithm':algorithm,'trace_view':'summary'}).get_json()['runs'][0]
                    scenes=result['presentation_scenes']
                    self.assertTrue(2<=len(scenes)<=10)
                    self.assertEqual([scene['event']['seq'] for scene in scenes],sorted(scene['event']['seq'] for scene in scenes))
                    for scene in scenes:
                        self.assertIn(scene['event'],result['summary_trace'])
                        self.assertTrue(scene['title'] and scene['narration'] and scene['explanation'])
                        if scene['phase']=='자리 계산':
                            event=scene['event'];column=event['column'];left,right,_=expression.replace(' = ',' + ').split(' + ')
                            def digit(word):return event['assignment'][word[-1-column]] if column<len(word) else 0
                            total=digit(left)+digit(right)+event['carry_in']
                            self.assertTrue(scene['formula'].endswith('= '+str(total)))
                            self.assertIn(str(total%10),scene['detail']);self.assertIn(str(total//10),scene['detail'])
                            self.assertIn('나머지',scene['explanation']);self.assertIn('몫',scene['explanation'])
                            result_word=expression.split(' = ')[1]
                            if column<len(result_word):
                                self.assertEqual(event['assignment'][result_word[-1-column]],total%10)
                    self.assertEqual(scenes[-1]['phase'],'마무리')

    def test_limited_search_is_never_presented_as_complete(self):
        result=create_app({'TESTING':True,'TIME_LIMIT_SECONDS':0}).test_client().post('/api/solve',json={'expression':'SEND + MORE = MONEY','algorithm':'backtracking','trace_view':'summary'}).get_json()['runs'][0]
        self.assertEqual(result['presentation_scenes'][-1]['phase'],'중단')
        self.assertNotIn('모두 마쳤',result['presentation_scenes'][-1]['title'])
