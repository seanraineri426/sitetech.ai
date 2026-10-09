#!/bin/bash
# Setup script for brief-reference tests
set -e

cd "$(dirname "$0")"

echo "Installing Python dependencies..."
python3 -m pip install -q -r requirements.txt

echo "✓ Setup complete"
