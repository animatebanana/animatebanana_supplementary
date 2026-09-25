"""A local preview server that answers Range requests.

`python -m http.server` does not: it ignores the `Range` header and sends the
whole file with a 200. A browser handed a 200 for a video treats it as not
seekable, so dragging the gallery's scrub bar past what has downloaded does
nothing - which looks exactly like a broken player, on a player that is fine.
Production static hosts answer 206 properly, so this only ever bites locally.

    python tools/serve.py            # http://127.0.0.1:8330
    python tools/serve.py 8080

No caching either, so an edited file is the file you get on reload.
"""
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')
        SimpleHTTPRequestHandler.end_headers(self)

    def send_head(self):
        rng = self.headers.get('Range')
        if not rng:
            return SimpleHTTPRequestHandler.send_head(self)

        m = re.match(r'bytes=(\d*)-(\d*)\s*$', rng)
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            return SimpleHTTPRequestHandler.send_head(self)

        size = os.path.getsize(path)
        first, last = m.group(1), m.group(2)
        if first:
            start = int(first)
            end = int(last) if last else size - 1
        else:                                  # bytes=-N: the last N bytes
            start, end = max(0, size - int(last or 0)), size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416, 'Requested range not satisfiable')
            return None

        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        # copyfile() would send to the end of the file; the range is what was
        # asked for, so the body is trimmed to it here instead.
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(64 * 1024, remaining))
            if not chunk:
                break
            try:
                self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break                          # the browser moved on; normal
            remaining -= len(chunk)
        f.close()
        return None


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8330
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
print('serving %s at http://127.0.0.1:%d  (ctrl-c to stop)' % (root, port))
ThreadingHTTPServer(('127.0.0.1', port), RangeHandler).serve_forever()
