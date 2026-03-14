#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Kounta Docker entrypoint
#
# - Generates an admin secret if none is set
# - Prints startup banner
# - Execs the main process
# ---------------------------------------------------------------------------

# Generate a random admin secret if not provided
if [ -z "$KOUNTA_ADMIN_SECRET" ]; then
  KOUNTA_ADMIN_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  export KOUNTA_ADMIN_SECRET
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  Generated KOUNTA_ADMIN_SECRET (save this — shown once):    ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║  $KOUNTA_ADMIN_SECRET  ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
fi

echo "Kounta v0.1.0 — double-entry ledger API"
echo "  Port:  ${PORT:-3001}"
echo "  Data:  ${KOUNTA_DATA_DIR:-/data}"
echo "  Docs:  https://kounta.ai/docs"
echo ""

exec "$@"
