#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Ledge Docker entrypoint
#
# - Generates an admin secret if none is set
# - Prints startup banner
# - Execs the main process
# ---------------------------------------------------------------------------

# Generate a random admin secret if not provided
if [ -z "$LEDGE_ADMIN_SECRET" ]; then
  LEDGE_ADMIN_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  export LEDGE_ADMIN_SECRET
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  Generated LEDGE_ADMIN_SECRET (save this — shown once):    ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║  $LEDGE_ADMIN_SECRET  ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
fi

echo "Ledge v0.1.0 — double-entry ledger API"
echo "  Port:  ${PORT:-3001}"
echo "  Data:  ${LEDGE_DATA_DIR:-/data}"
echo "  Docs:  https://getledge.dev/docs"
echo ""

exec "$@"
