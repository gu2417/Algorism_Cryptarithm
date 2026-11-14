from flask import Blueprint, current_app, jsonify, request

from Feature.solve import run
from Feature.trace_archive import TraceArchive
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
        view = payload.get('trace_view', 'full')
        if view not in ('summary', 'full'):
            raise InputError('INVALID_TRACE_VIEW', '전체 또는 요약 보기를 선택해 주세요.')
        runs = [run(problem, name, time_limit=current_app.config['TIME_LIMIT_SECONDS'],
                    solution_limit=current_app.config['SOLUTION_LIMIT'],
                    trace_limit=current_app.config['TRACE_LIMIT']) for name in algorithms]
        if view == 'summary':
            for result in runs:
                archive = TraceArchive(problem, result)
                result['trace_total'] = archive.total
                result['trace_paged'] = True
                result['trace_buffer_limited'] = result['trace_truncated']
                result['trace_truncated'] = False
                result['trace_token'] = current_app.extensions['trace_store'].put(archive)
                result['trace'] = []
        return jsonify(original_expression=problem.original, normalized_expression=problem.normalized, runs=runs)
    except InputError as error:
        return jsonify(error={'code': error.code, 'message': str(error)}), 400


@routes.get('/api/traces/<token>')
def trace(token):
    events = current_app.extensions['trace_store'].get(token)
    if events is None:
        return jsonify(error={'code': 'TRACE_EXPIRED', 'message': '기록 보관 시간이 지났거나 최근 실행으로 대체되었습니다. 다시 풀이해 주세요.'}), 404
    if request.args:
        try:
            offset = int(request.args.get('offset', 0))
            limit = int(request.args.get('limit', 200))
            if offset < 0 or not 1 <= limit <= 500 or offset >= events.total:
                raise ValueError()
        except ValueError:
            return jsonify(error={'code':'INVALID_PAGE','message':'유효한 기록 범위를 선택해 주세요.'}), 400
        return jsonify(trace=events.page(offset, limit), offset=offset, total=events.total)
    return jsonify(trace=events.prefix)
