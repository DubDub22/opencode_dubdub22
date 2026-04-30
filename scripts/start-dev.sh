#!/bin/bash
echo "Stopping existing dev servers..."
for pid in $(ss -tlnp | grep ':5002 ' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 $pid 2>/dev/null && echo "  Killed PID $pid"
done
sleep 2
if ss -tlnp | grep -q ':5002 '; then echo "ERROR: Port 5002 still in use"; exit 1; fi
echo "Building..."
cd /home/dubdub/DubDubSuppressor-v2
git fetch origin && git reset --hard origin/main
npm run build 2>&1 | tail -3
echo "Starting on port 5002..."
HOST=0.0.0.0 PORT=5002 nohup node --env-file=.env dist/index.js > /tmp/dubdub-dev.log 2>&1 &
PID=$!
echo "PID: $PID"
sleep 4
head -1 /tmp/dubdub-dev.log
echo "Ready at http://45.33.121.147:5002"
