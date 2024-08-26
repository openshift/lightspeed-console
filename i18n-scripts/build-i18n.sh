#!/usr/bin/env bash

set -exuo pipefail

FILE_PATTERN="src/**/*.{ts,tsx}"

i18next "${FILE_PATTERN}" [-oc] -c "./i18next-parser.config.js" -o "locales/\$LOCALE/\$NAMESPACE.json"
