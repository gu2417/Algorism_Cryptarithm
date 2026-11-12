from flask import Blueprint, current_app, jsonify, request

from Feature.solve import run
from Module.validation import InputError, parse_expression

routes = Blueprint('routes', __name__)


@routes.post('/api/solve')
def solve():
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise InputError('INVALID_FORMAT', 'JSON 객체를 입력해 주세요.')
        problem = parse_expression(payload.get('expression'))
        algorithm = payload.get('algorithm')
        if not isinstance(algorithm, str) or algorithm not in ('backtracking', 'brute_force', 'compare'):
            raise InputError('INVALID_ALGORITHM', '지원하는 알고리즘을 선택해 주세요.')
        algorithms = ('brute_force', 'backtracking') if algorithm == 'compare' else (algorithm,)
        runs = [run(problem, name, time_limit=current_app.config['TIME_LIMIT_SECONDS'],
                    solution_limit=current_app.config['SOLUTION_LIMIT'],
                    trace_limit=current_app.config['TRACE_LIMIT']) for name in algorithms]
        return jsonify(original_expression=problem.original, normalized_expression=problem.normalized, runs=runs)
    except InputError as error:
        return jsonify(error={'code': error.code, 'message': str(error)}), 400
