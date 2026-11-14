import time

from collections import Counter, deque

from Core import backtracking, brute_force
from Feature.control import SearchControl, SearchStopped
from Feature.summary import build_summary
from Feature.presentation import build_presentation


def run(problem, algorithm, *, time_limit, solution_limit, trace_limit):
    control = SearchControl(time_limit, solution_limit)
    trace = []
    truncated = False
    summary = {}
    counts = Counter()
    recent = deque(maxlen=32)
    event_count = 0
    important = {'start', 'candidate', 'assign', 'complete_check', 'column_calculation',
                 'carry_check', 'conflict', 'prune', 'backtrack'}

    def record(event):
        nonlocal truncated, event_count
        event_count = event['seq'] + 1
        if len(trace) < trace_limit:
            trace.append(event)
        else:
            truncated = True
        kind = event['type']
        if kind in important and counts[kind] < 3:
            summary[event['seq']] = event
            counts[kind] += 1
        if kind == 'solution' and not counts[kind]:
            for previous in recent:
                if previous['seq'] >= event['seq'] - 32:
                    summary[previous['seq']] = previous
            summary[event['seq']] = event
            counts[kind] += 1
        if kind == 'finish':
            summary[event['seq']] = event
        recent.append(event)
        record.capture = len(trace) < trace_limit or any(counts[kind] < 3 for kind in ('candidate', 'assign', 'complete_check', 'backtrack'))

    record.capture = True

    try:
        if algorithm == 'brute_force':
            brute_force.solve(problem, control=control, emit=record)
        else:
            backtracking.solve(problem, emit=record, control=control)
    except SearchStopped:
        pass
    event_count = getattr(record, 'events_seen', event_count)
    elapsed = (time.monotonic() - control.started) * 1000

    def numeric(word, mapping):
        return ''.join(str(mapping[char]) for char in word)

    solutions = [{'mapping': mapping, 'numeric_expression':
                  f'{numeric(problem.left, mapping)} + {numeric(problem.right, mapping)} = {numeric(problem.result, mapping)}'}
                 for mapping in control.solutions]
    result = {'algorithm': algorithm, 'status': control.status, 'solutions': solutions,
            'solutions_found': len(solutions),
            'statistics': {'assignment_attempts': control.assignment_attempts,
                           'complete_assignments_checked': control.complete_assignments_checked,
                           'prunes': control.prunes, 'elapsed_ms': elapsed},
            'trace': trace, 'trace_truncated': truncated,
            'summary_trace': [summary[key] for key in sorted(summary)],
            'events_seen': event_count}
    result['summary_trace'], result['summary_sections'] = build_summary(problem, result)
    result['presentation_scenes'] = build_presentation(problem, result)
    return result
