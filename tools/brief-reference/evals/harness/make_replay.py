#!/usr/bin/env python3
"""Build a zero-cost replay dir from a past run: <out>/<stage>.json = that run's raw model response text for <stage>.
Use with MODEL=mock:replay HARNESS_MOCK_DIR=<out> to push the exact same model outputs through the current (code) stages.
Usage: python harness/make_replay.py runs/<ts> /tmp/replay"""
import json, os, sys, glob
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, "raw", "*.json"))):
    d = json.load(open(f)); open(os.path.join(out, d["stage"] + ".json"), "w").write(d.get("response_text") or "")
    json.dump({"finish_reason": d.get("finish_reason")}, open(os.path.join(out, d["stage"] + ".meta.json"), "w"))
    print(d["stage"], d.get("finish_reason"), len(d.get("response_text") or ""))
