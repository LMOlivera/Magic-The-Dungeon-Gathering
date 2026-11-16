"""
Local development server: the same as `python3 -m http.server`, but it tells
the browser not to cache anything. Without that, the browser can mix an old
copy of one module with a new copy of another after an edit, and the page
breaks with "doesn't provide an export named ...".

Usage: python3 scripts/serve.py [port]   (default 8000; `npm start` runs it)
"""

import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving on http://localhost:{port} (no caching)")
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
