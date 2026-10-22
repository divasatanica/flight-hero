#!/bin/sh
set -eu

concurrently --kill-others --names be,fe "node outputs/be/index.js" "npx serve outputs/fe/ -p 4001"