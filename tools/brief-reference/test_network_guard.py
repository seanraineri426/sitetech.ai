#!/usr/bin/env python3
"""Demonstrate that the network guard blocks network access."""
import socket

# Apply network guard
_original_socket = socket.socket

def _blocked_socket(*args, **kwargs):
    raise RuntimeError("NETWORK ACCESS BLOCKED: Tests must run fully offline.")

socket.socket = _blocked_socket

# Try to make a network request
print("Attempting to create a socket connection...")
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(("example.com", 80))
    print("❌ FAIL: Network access was NOT blocked!")
    exit(1)
except RuntimeError as e:
    if "NETWORK ACCESS BLOCKED" in str(e):
        print(f"✓ SUCCESS: Network guard blocked the connection")
        print(f"   Error message: {e}")
        exit(0)
    else:
        print(f"❌ FAIL: Wrong error: {e}")
        exit(1)
except Exception as e:
    print(f"❌ FAIL: Unexpected error: {e}")
    exit(1)
