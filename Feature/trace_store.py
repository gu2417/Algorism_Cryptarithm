"""프로세스별 임시 기록 저장소. 최근 4개 실행만 보관하며 영구 저장하지 않는다."""
from collections import OrderedDict
from secrets import token_urlsafe
from threading import Lock
from time import monotonic


class TraceStore:
    def __init__(self, capacity=4, ttl=600):
        self.items = OrderedDict()
        self.lock = Lock()
        self.capacity = capacity
        self.ttl = ttl

    def put(self, events):
        with self.lock:
            token = token_urlsafe(24)
            self.items[token] = (monotonic(), events)
            while len(self.items) > self.capacity:
                self.items.popitem(last=False)
            return token

    def get(self, token):
        with self.lock:
            item = self.items.get(token)
            if item is None:
                return None
            if monotonic() - item[0] > self.ttl:
                del self.items[token]
                return None
            self.items.move_to_end(token)
            return item[1]
