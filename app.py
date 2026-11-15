from flask import Flask, jsonify, render_template
from werkzeug.exceptions import HTTPException
from Module.routes import routes


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(TIME_LIMIT_SECONDS=5.0, SOLUTION_LIMIT=100, TRACE_LIMIT=80000)
    from Feature.trace_store import TraceStore
    app.extensions['trace_store'] = TraceStore()
    if config:
        app.config.update(config)
    app.register_blueprint(routes)

    @app.get('/')
    def index():
        return render_template('index.html')

    @app.errorhandler(Exception)
    def internal_error(error):
        if isinstance(error, HTTPException):
            return error
        app.logger.exception('풀이 요청 처리 실패')
        return jsonify(error={'code': 'INTERNAL_ERROR', 'message': '서버에서 요청을 처리하지 못했습니다.'}), 500

    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=5000)
