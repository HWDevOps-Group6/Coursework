#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'EOF'
Usage: check_gateway_health.sh -n <namespace> [-s <service>] [-p <local-port>] [-r <remote-port>] [-k <kubeconfig>] [-c <kubectl>]
EOF
}

NAMESPACE=""
SERVICE_NAME="gateway"
LOCAL_PORT="18080"
REMOTE_PORT="80"
KUBECONFIG_PATH="${KUBECONFIG:-}"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
CURL_BIN="${CURL_BIN:-curl}"
PF_PID=""

cleanup() {
  if [[ -n "$PF_PID" ]]; then
    kill "$PF_PID" >/dev/null 2>&1 || true
    wait "$PF_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

while getopts ':n:s:p:r:k:c:h' opt; do
  case "$opt" in
    n) NAMESPACE="$OPTARG" ;;
    s) SERVICE_NAME="$OPTARG" ;;
    p) LOCAL_PORT="$OPTARG" ;;
    r) REMOTE_PORT="$OPTARG" ;;
    k) KUBECONFIG_PATH="$OPTARG" ;;
    c) KUBECTL_BIN="$OPTARG" ;;
    h)
      print_usage
      exit 3
      ;;
    *)
      print_usage >&2
      exit 3
      ;;
  esac
done

if [[ -z "$NAMESPACE" ]]; then
  print_usage >&2
  exit 3
fi

if ! command -v "$KUBECTL_BIN" >/dev/null 2>&1; then
  echo "CRITICAL - kubectl binary not found: $KUBECTL_BIN"
  exit 2
fi

if ! command -v "$CURL_BIN" >/dev/null 2>&1; then
  echo "CRITICAL - curl binary not found: $CURL_BIN"
  exit 2
fi

KUBECTL_ARGS=("$KUBECTL_BIN")
if [[ -n "$KUBECONFIG_PATH" ]]; then
  if [[ ! -f "$KUBECONFIG_PATH" ]]; then
    echo "CRITICAL - kubeconfig not found: $KUBECONFIG_PATH"
    exit 2
  fi
  KUBECTL_ARGS+=(--kubeconfig "$KUBECONFIG_PATH")
fi

pkill -f "kubectl.*port-forward.*${LOCAL_PORT}:${REMOTE_PORT}" >/dev/null 2>&1 || true

if ! ${KUBECTL_ARGS[@]} -n "$NAMESPACE" port-forward "svc/${SERVICE_NAME}" "${LOCAL_PORT}:${REMOTE_PORT}" >/tmp/coursework-nagios-gateway.log 2>&1 & then
  echo "CRITICAL - failed to start port-forward for svc/${SERVICE_NAME}"
  exit 2
fi
PF_PID=$!

HEALTH_JSON=""
for _ in {1..20}; do
  if HEALTH_JSON="$($CURL_BIN -fsS --max-time 5 "http://127.0.0.1:${LOCAL_PORT}/health" 2>/dev/null)"; then
    break
  fi
  if ! kill -0 "$PF_PID" >/dev/null 2>&1; then
    echo "CRITICAL - gateway port-forward exited unexpectedly: $(cat /tmp/coursework-nagios-gateway.log 2>/dev/null || true)"
    exit 2
  fi
  sleep 2
done

if [[ -z "$HEALTH_JSON" ]]; then
  echo "CRITICAL - gateway health endpoint did not respond on port ${LOCAL_PORT}"
  if [[ -f /tmp/coursework-nagios-gateway.log ]]; then
    echo "DETAIL - $(tail -n 1 /tmp/coursework-nagios-gateway.log)"
  fi
  exit 2
fi

HEALTH_JSON="$HEALTH_JSON" python3 - <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["HEALTH_JSON"])
backends = payload.get("backends", {})
required = {
    "auth": backends.get("auth"),
    "patientRegistration": backends.get("patientRegistration"),
    "diagnosticsVitals": backends.get("diagnosticsVitals"),
}
down = [name for name, status in required.items() if status != "up"]
if down:
    print("CRITICAL - gateway health reports backend(s) down: " + ", ".join(f"{name}={required[name]}" for name in down))
    sys.exit(2)
print("OK - gateway and all backend dependencies report healthy")
sys.exit(0)
PY
