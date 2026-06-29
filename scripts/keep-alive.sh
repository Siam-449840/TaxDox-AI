#!/bin/bash
# Keep-alive wrapper for the dev server.
# Restarts automatically if the process dies.
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..."
  bun run dev
  EXIT_CODE=$?
  echo "[$(date)] Dev server exited with code $EXIT_CODE. Restarting in 3s..."
  sleep 3
done
