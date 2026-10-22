#!/bin/sh
set -eu

# Resolve paths from this script so the copy does not depend on the caller's directory.
cd "$(dirname "$0")"

tsc

# Replace only the backend copy, preserving the frontend build in output/fe.
mkdir -p ../../outputs
rm -rf ../../outputs/be
mkdir -p ../../outputs/be
cp -R dist/. ../../outputs/be/
