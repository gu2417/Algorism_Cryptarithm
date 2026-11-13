import time

from Core import backtracking, brute_force
from Feature.control import SearchControl, SearchStopped


def run(problem, algorithm, *, time_limit, solution_limit, trace_limit):
    control = SearchControl(time_limit, solution_limit)
    trace = []
    truncated = False

    def record(event):
        nonlocal truncated
        if len(trace) < trace_limit:
            trace.append(event)
        else:
            truncated = True

    try:
        if algorithm == 'brute_force':
            brute_force.solve(problem, control=control, emit=record)
        else:
            backtracking.solve(problem, emit=record, control=control)
    except SearchStopped:
        pass
    elapsed = (time.monotonic() - control.started) * 1000

    def numeric(word, mapping):
        return ''.join(str(mapping[char]) for char in word)

    solutions = [{'mapping': mapping, 'numeric_expression':
                  f'{numeric(problem.left, mapping)} + {numeric(problem.right, mapping)} = {numeric(problem.result, mapping)}'}
                 for mapping in control.solutions]
    return {'algorithm': algorithm, 'status': control.status, 'solutions': solutions,
            'solutions_found': len(solutions),
            'statistics': {'assignment_attempts': control.assignment_attempts,
                           'complete_assignments_checked': control.complete_assignments_checked,
                           'prunes': control.prunes, 'elapsed_ms': elapsed},
            'trace': trace, 'trace_truncated': truncated}
