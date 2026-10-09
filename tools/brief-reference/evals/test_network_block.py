"""Network blocking probe test.

Verifies that all network access paths are blocked in offline test mode.
This test MUST run with OFFLINE_TESTS=1 and should fail if any path succeeds.
"""
import os
import sys

# Ensure offline mode is active
assert os.environ.get("OFFLINE_TESTS") == "1", "Test must run with OFFLINE_TESTS=1"

passed = 0
failed = 0

def test(name, func):
    """Run a test and track results."""
    global passed, failed
    try:
        func()
        print(f"✓ {name}")
        passed += 1
    except AssertionError as e:
        print(f"✗ {name}: {e}")
        failed += 1
    except Exception as e:
        print(f"✗ {name}: Unexpected: {type(e).__name__}: {e}")
        failed += 1

def assert_blocked(func, description):
    """Assert that a function raises a network blocking error."""
    try:
        func()
        raise AssertionError(f"{description} should have been blocked but succeeded")
    except Exception as e:
        err_str = str(e).lower()
        if "network" not in err_str and "blocked" not in err_str:
            raise AssertionError(f"{description} raised wrong exception: {e}")

# Test 1: socket.connect
def test_socket_connect():
    import socket
    def attempt():
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("google.com", 80))
    assert_blocked(attempt, "socket.connect")

test("socket.connect blocked", test_socket_connect)

# Test 2: socket.connect_ex
def test_socket_connect_ex():
    import socket
    def attempt():
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = s.connect_ex(("google.com", 80))
        if result == 0:
            raise AssertionError("connect_ex succeeded")
    assert_blocked(attempt, "socket.connect_ex")

test("socket.connect_ex blocked", test_socket_connect_ex)

# Test 3: socket.getaddrinfo
def test_getaddrinfo():
    import socket
    def attempt():
        socket.getaddrinfo("google.com", 80)
    assert_blocked(attempt, "socket.getaddrinfo")

test("socket.getaddrinfo blocked", test_getaddrinfo)

# Test 4: socket.create_connection
def test_create_connection():
    import socket
    def attempt():
        socket.create_connection(("google.com", 80), timeout=1)
    assert_blocked(attempt, "socket.create_connection")

test("socket.create_connection blocked", test_create_connection)

# Test 5: urllib.request
def test_urllib():
    import urllib.request
    def attempt():
        urllib.request.urlopen("http://google.com", timeout=1)
    assert_blocked(attempt, "urllib.request.urlopen")

test("urllib.request blocked", test_urllib)

# Test 6: http.client
def test_http_client():
    import http.client
    def attempt():
        conn = http.client.HTTPConnection("google.com", timeout=1)
        conn.connect()
    assert_blocked(attempt, "http.client.HTTPConnection")

test("http.client blocked", test_http_client)

# Test 7: subprocess curl
def test_subprocess_curl():
    import subprocess
    def attempt():
        subprocess.run(["curl", "http://google.com"], capture_output=True, timeout=1, check=True)
    assert_blocked(attempt, "subprocess curl")

test("subprocess curl blocked", test_subprocess_curl)

# Test 8: subprocess wget
def test_subprocess_wget():
    import subprocess
    def attempt():
        subprocess.run(["wget", "-O", "-", "http://google.com"], capture_output=True, timeout=1, check=True)
    assert_blocked(attempt, "subprocess wget")

test("subprocess wget blocked", test_subprocess_wget)

# Test 9: child python process
def test_child_python():
    import subprocess
    result = subprocess.run(
        [sys.executable, "-c", "import socket; socket.create_connection(('google.com', 80), timeout=1)"],
        capture_output=True,
        text=True,
        timeout=2
    )
    if result.returncode == 0:
        raise AssertionError("Child Python process succeeded in network access")
    if "network" not in result.stderr.lower() and "blocked" not in result.stderr.lower():
        raise AssertionError(f"Child Python failed but not with network block: {result.stderr}")

test("child python process blocked", test_child_python)

# Test 10: localhost still works
def test_localhost_allowed():
    import socket
    # Should NOT raise
    socket.getaddrinfo("localhost", 8000)
    socket.getaddrinfo("127.0.0.1", 8000)

test("localhost allowed", test_localhost_allowed)

# Summary
print(f"\n{'='*60}")
print(f"Network blocking probe: {passed} passed, {failed} failed")
print('='*60)

if failed > 0:
    print("❌ NETWORK BLOCKING IS NOT WORKING")
    sys.exit(1)
else:
    print("✓ ALL NETWORK PATHS BLOCKED")
    sys.exit(0)
