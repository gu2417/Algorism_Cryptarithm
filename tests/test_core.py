import unittest

from Module.validation import InputError, parse_expression
from Core.constraints import is_solution
from Core.brute_force import solve as brute_force
from Core.backtracking import solve as backtracking


class InputTests(unittest.TestCase):
    def test_normalizes_and_extracts_problem(self):
        p = parse_expression(' send + more = money ')
        self.assertEqual((p.left, p.right, p.result), ('SEND', 'MORE', 'MONEY'))
        self.assertEqual(p.normalized, 'SEND + MORE = MONEY')
        self.assertEqual(p.leading, frozenset('SM'))

    def test_invalid_inputs_have_specific_codes(self):
        for text, code in [('', 'EMPTY_INPUT'), ('A - B = C', 'INVALID_FORMAT'),
                           ('A1 + B = C', 'INVALID_FORMAT'), ('A B + C = D', 'INVALID_FORMAT'),
                           ('ABCDEFGHIJ + K = A', 'TOO_MANY_LETTERS'), ('A' * 129, 'TOO_LONG')]:
            with self.subTest(text=text), self.assertRaises(InputError) as exc:
                parse_expression(text)
            self.assertEqual(exc.exception.code, code)


class ConstraintTests(unittest.TestCase):
    def test_validates_complete_assignment_and_single_zero(self):
        p = parse_expression('A + B = B')
        self.assertTrue(is_solution(p, {'A': 0, 'B': 2}))
        self.assertFalse(is_solution(p, {'A': 2, 'B': 2}))
        self.assertFalse(is_solution(p, {'A': 0}))
        self.assertFalse(is_solution(p, {'A': 10, 'B': 2}))
        self.assertFalse(is_solution(p, {'A': False, 'B': 2}))

    def test_rejects_leading_zero(self):
        p = parse_expression('AB + C = D')
        self.assertFalse(is_solution(p, {'A': 0, 'B': 1, 'C': 2, 'D': 3}))


class SolverTests(unittest.TestCase):
    def test_both_algorithms_match_for_multiple_and_no_solutions(self):
        for expression in ('A + B = C', 'A + A = A', 'A + B = AA', 'AA + B = BB'):
            with self.subTest(expression=expression):
                p = parse_expression(expression)
                def canonical(items):
                    return {tuple(sorted(item.items())) for item in items}
                actual = backtracking(p)
                self.assertEqual(canonical(actual), canonical(brute_force(p)))
                self.assertTrue(all(is_solution(p, mapping) for mapping in actual))
        self.assertGreater(len(backtracking(parse_expression('A + B = C'))), 1)
        self.assertEqual(backtracking(parse_expression('A + A = A')), [{'A': 0}])
        self.assertEqual(backtracking(parse_expression('A + B = AA')), [])

    def test_solvers_agree_on_repeated_and_result_only_letters(self):
        expressions = ('A + A = B', 'AB + A = BA', 'AA + BB = CC',
                       'A + B = CD', 'AB + C = BA', 'AB + BA = CC')
        for expression in expressions:
            with self.subTest(expression=expression):
                problem = parse_expression(expression)
                canonical = lambda values: {tuple(sorted(v.items())) for v in values}
                self.assertEqual(canonical(backtracking(problem)), canonical(brute_force(problem)))

    def test_presentation_examples_and_multiple_carries(self):
        solutions = backtracking(parse_expression('SEND + MORE = MONEY'))
        self.assertEqual(solutions, [{'S': 9, 'E': 5, 'N': 6, 'D': 7, 'M': 1, 'O': 0, 'R': 8, 'Y': 2}])
        problem = parse_expression('I + BB = ILL')
        self.assertTrue(backtracking(problem))
        self.assertTrue(all(is_solution(problem, x) for x in backtracking(problem)))

    def test_trace_reports_real_backtracks_and_snapshots(self):
        events = []
        solutions = backtracking(parse_expression('A + B = C'), events.append)
        self.assertTrue(solutions)
        self.assertEqual(events[0]['type'], 'start')
        self.assertEqual(events[-1]['type'], 'finish')
        self.assertTrue(any(e['type'] == 'backtrack' and e['undo'] for e in events))
        self.assertEqual([e['seq'] for e in events], list(range(len(events))))
        self.assertEqual(events[0]['assignment'], {})


if __name__ == '__main__':
    unittest.main()
