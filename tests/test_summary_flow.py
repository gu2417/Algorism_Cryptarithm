import unittest
from app import create_app


class SummaryFlowTests(unittest.TestCase):
    def test_other_inputs_also_keep_assignment_changes_explainable(self):
        import random
        random.seed(976)
        client=create_app({'TESTING':True,'TRACE_LIMIT':2}).test_client()
        for _ in range(20):
            words=[''.join(random.choices('ABCD',k=random.randint(1,3))) for _ in range(3)]
            expression=f'{words[0]} + {words[1]} = {words[2]}'
            for algorithm in ('backtracking','brute_force'):
                result=client.post('/api/solve',json={'expression':expression,'algorithm':algorithm,'trace_view':'summary'}).get_json()['runs'][0]
                events=result['summary_trace']
                for previous,current in zip(events,events[1:]):
                    if current['type']=='finish':
                        continue
                    expected=previous['assignment'].copy()
                    if current['type']=='assign':
                        letter,digit=current['check'].split('=');expected[letter]=int(digit)
                    elif current['type']=='backtrack':
                        for letter in current['undo']:
                            expected.pop(letter,None)
                    self.assertEqual(current['assignment'],expected,expression+algorithm)

    def test_calculation_and_carry_never_switch_candidates(self):
        client=create_app({'TESTING':True}).test_client()
        for expression in ('I + BB = ILL','SEND + MORE = MONEY','A + A = A','A + B = C','A + B = AA'):
            for algorithm in ('backtracking','brute_force'):
                with self.subTest(expression=expression,algorithm=algorithm):
                    result=client.post('/api/solve',json={'expression':expression,'algorithm':algorithm,'trace_view':'summary'}).get_json()['runs'][0]
                    events=result['summary_trace']
                    for previous,current in zip(events,events[1:]):
                        if current['type']!='finish':
                            expected=previous['assignment'].copy()
                            if current['type']=='assign':
                                letter,digit=current['check'].split('=');expected[letter]=int(digit)
                            elif current['type']=='backtrack':
                                for letter in current['undo']:
                                    expected.pop(letter,None)
                            self.assertEqual(current['assignment'],expected,'생략 사이에서 설명 없이 후보가 바뀌면 안 됨')
                        if previous['type']=='column_calculation' and current['type']=='carry_check':
                            self.assertEqual(current['assignment'],previous['assignment'])
                            self.assertEqual(current['column'],previous['column'])
                            self.assertEqual(current['seq'],previous['seq']+1)
                    solutions=[i for i,event in enumerate(events) if event['type']=='solution']
                    if solutions:
                        expected_tail=['finish'] if result['status']=='complete' else []
                        self.assertEqual([event['type'] for event in events[solutions[0]+1:]],expected_tail)
