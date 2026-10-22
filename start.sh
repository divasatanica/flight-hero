#!/bin/sh
set -eu

npm install

npm run build

concurrently --kill-others --names be,fe "node outputs/be/index.js" "npx serve outputs/fe/ -p 4001"