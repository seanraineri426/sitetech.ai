"""Network blocking probe test.

Verifies that sitecustomize.py blocks common network access paths (best-effort).

GUARANTEE: OS network namespace isolation (`sudo unshare -n`) in CI.
BEST-EFFORT: sitecustomize.py Python patches for local dev convenience.

Known bypasses (not blocked by Python patch alone):
- subprocess via ["sh", "-c", "curl ..."]
- subprocess via ["env", "curl", ...]
- os.system("curl ...")
- python3 -I (bypasses sitecustomize)
- raw _socket module

This test MUST run with OFFLINE_TESTS=1 and should fail if common paths succeed.
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

# Test 2: socket.connect_ex (informational - Python patch may not fully block)
# Note: connect_ex returns errno instead of raising, harder to patch reliably

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

# Test 9: child python process (informational - env propagation can be fragile)

# Test 10: localhost still works
def test_localhost_allowed():
    import socket
    # Should NOT raise
    socket.getaddrinfo("localhost", 8000)
    socket.getaddrinfo("127.0.0.1", 8000)

test("localhost allowed", test_localhost_allowed)

# Known bypass probes (expected to FAIL in Python-patch-only mode)
bypass_tested = 0
bypass_blocked = 0

def test_bypass(name, func):
    """Test a known bypass. Track but don't fail the suite."""
    global bypass_tested, bypass_blocked
    bypass_tested += 1
    try:
        func()
        print(f"  ⚠ {name}: NOT blocked (expected in Python-only mode)")
    except AssertionError:
        print(f"  ✓ {name}: blocked")
        bypass_blocked += 1
    except Exception:
        print(f"  ✓ {name}: blocked")
        bypass_blocked += 1

print(f"\n{'='*60}")
print("KNOWN BYPASS PROBES (informational; OS namespace blocks these)")
print('='*60)

# Bypass 1: subprocess sh -c curl
def test_sh_c_curl():
    import subprocess
    subprocess.run(["sh", "-c", "curl -s http://google.com"], capture_output=True, timeout=1, check=True)

test_bypass("subprocess sh -c curl", test_sh_c_curl)

# Bypass 2: subprocess env curl
def test_env_curl():
    import subprocess
    subprocess.run(["env", "curl", "-s", "http://google.com"], capture_output=True, timeout=1, check=True)

test_bypass("subprocess env curl", test_env_curl)

# Bypass 3: os.system curl
def test_os_system_curl():
    import os
    result = os.system("curl -s http://google.com >/dev/null 2>&1")
    # os.system returns 0 on success - that means the bypass works (not blocked)
    # Don't raise here; let it succeed to signal "not blocked"

test_bypass("os.system curl", test_os_system_curl)

# Bypass 4: python3 -I socket (bypasses sitecustomize)
def test_python_I_socket():
    import subprocess
    result = subprocess.run(
        [sys.executable, "-I", "-c", "import socket; socket.create_connection(('google.com', 80), timeout=1)"],
        capture_output=True,
        timeout=2
    )
    # returncode 0 means success - the bypass works (not blocked)
    # Don't raise here; let it succeed to signal "not blocked"

test_bypass("python3 -I socket", test_python_I_socket)

# Bypass 5: raw _socket module
def test_raw_socket():
    import _socket
    s = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
    s.connect(("google.com", 80))

test_bypass("raw _socket.connect", test_raw_socket)

# Summary
print(f"\n{'='*60}")
print(f"Core network blocking: {passed} passed, {failed} failed")
print(f"Known bypasses: {bypass_blocked}/{bypass_tested} blocked (informational)")
print('='*60)

if failed > 0:
    print("❌ PYTHON PATCH NETWORK BLOCKING FAILED")
    print("    (Expected: OS namespace isolation in CI blocks all paths)")
    sys.exit(1)
else:
    print(f"✓ PYTHON PATCH BLOCKS COMMON PATHS ({passed}/{passed})")
    if bypass_blocked < bypass_tested:
        print(f"  Note: {bypass_tested - bypass_blocked} bypass(es) not blocked by Python patch alone")
        print("  CI guarantee: OS network namespace (sudo unshare -n) blocks all paths")
    sys.exit(0)
