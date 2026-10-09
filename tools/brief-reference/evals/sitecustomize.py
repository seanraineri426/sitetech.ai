"""Network blocking for offline tests (injected via PYTHONPATH).

This module is loaded automatically by Python at startup and patches all network
access points to ensure tests run offline. Used by evals test suite.
"""
import os
import sys

# Only block if OFFLINE_TESTS is set
if os.environ.get("OFFLINE_TESTS") == "1":
    import socket as _real_socket
    import subprocess as _real_subprocess
    
    class NetworkBlockedError(Exception):
        """Raised when network access is attempted in offline tests."""
        pass
    
    # Patch socket.connect and connect_ex
    original_connect = _real_socket.socket.connect
    original_connect_ex = _real_socket.socket.connect_ex
    
    def blocked_connect(self, address):
        # Allow localhost
        host = address[0] if isinstance(address, tuple) else address
        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return original_connect(self, address)
        raise NetworkBlockedError(f"Network access blocked: connect to {address}")
    
    def blocked_connect_ex(self, address):
        # Allow localhost
        host = address[0] if isinstance(address, tuple) else address
        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return original_connect_ex(self, address)
        # connect_ex returns errno, not raise (errno 1 = EPERM)
        return 1
    
    _real_socket.socket.connect = blocked_connect
    _real_socket.socket.connect_ex = blocked_connect_ex
    
    # Patch socket.getaddrinfo
    original_getaddrinfo = _real_socket.getaddrinfo
    
    def blocked_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        # Allow localhost
        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return original_getaddrinfo(host, port, family, type, proto, flags)
        raise NetworkBlockedError(f"Network access blocked: getaddrinfo for {host}:{port}")
    
    _real_socket.getaddrinfo = blocked_getaddrinfo
    
    # Patch socket.create_connection
    original_create_connection = _real_socket.create_connection
    
    def blocked_create_connection(address, timeout=None, source_address=None):
        host, port = address
        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return original_create_connection(address, timeout, source_address)
        raise NetworkBlockedError(f"Network access blocked: create_connection to {address}")
    
    _real_socket.create_connection = blocked_create_connection
    
    # Patch subprocess to block network tools and propagate environment
    original_popen = _real_subprocess.Popen
    
    BLOCKED_COMMANDS = ["curl", "wget", "nc", "telnet", "ping", "nslookup", "dig", "host"]
    
    class BlockedPopen(_real_subprocess.Popen):
        def __init__(self, args, **kwargs):
            # Check for blocked commands
            if isinstance(args, list) and args:
                cmd = os.path.basename(str(args[0]))
                if cmd in BLOCKED_COMMANDS:
                    raise NetworkBlockedError(f"Network tool blocked: {cmd}")
            if isinstance(args, str):
                # Handle shell=True: parse out base command
                import shlex
                try:
                    parts = shlex.split(args)
                    if parts:
                        cmd = os.path.basename(parts[0])
                        if cmd in BLOCKED_COMMANDS:
                            raise NetworkBlockedError(f"Network tool blocked: {cmd}")
                except:
                    # Fallback for unparseable
                    for cmd in BLOCKED_COMMANDS:
                        if f" {cmd} " in f" {args} " or args.startswith(cmd + " ") or args == cmd:
                            raise NetworkBlockedError(f"Network tool blocked: {cmd}")
            
            # Propagate OFFLINE_TESTS and PYTHONPATH to child processes
            if 'env' not in kwargs:
                kwargs['env'] = os.environ.copy()
            if kwargs['env'] is None:
                kwargs['env'] = os.environ.copy()
            kwargs['env']['OFFLINE_TESTS'] = '1'
            if 'PYTHONPATH' in os.environ:
                kwargs['env']['PYTHONPATH'] = os.environ['PYTHONPATH']
            
            super().__init__(args, **kwargs)
    
    _real_subprocess.Popen = BlockedPopen
    
    print(f"[sitecustomize] Network blocking active (PID {os.getpid()})", file=sys.stderr, flush=True)
