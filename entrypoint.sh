#!/bin/sh
set -eu

case "${OCP_VERSION:-}" in
  4.16|4.17|4.18) BUILD_DIR=/builds/pf5 ;;
  4.19|4.20|4.21) BUILD_DIR=/builds/4-19 ;;
  *)              BUILD_DIR=/builds/main ;;
esac

ln -sfn "$BUILD_DIR" /tmp/nginx/html
exec nginx -g 'daemon off;' -e stderr
