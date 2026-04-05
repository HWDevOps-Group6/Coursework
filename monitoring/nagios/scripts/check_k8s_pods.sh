#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'EOF'
Usage: check_k8s_pods.sh -n <namespace> [-k <kubeconfig>] [-c <kubectl>]
EOF
}

NAMESPACE=""
KUBECONFIG_PATH="${KUBECONFIG:-}"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"

while getopts ':n:k:c:h' opt; do
  case "$opt" in
    n) NAMESPACE="$OPTARG" ;;
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

KUBECTL_ARGS=("$KUBECTL_BIN")
if [[ -n "$KUBECONFIG_PATH" ]]; then
  if [[ ! -f "$KUBECONFIG_PATH" ]]; then
    echo "CRITICAL - kubeconfig not found: $KUBECONFIG_PATH"
    exit 2
  fi
  KUBECTL_ARGS+=(--kubeconfig "$KUBECONFIG_PATH")
fi

if ! PODS_JSON="$(${KUBECTL_ARGS[@]} -n "$NAMESPACE" get pods -o json 2>&1)"; then
  echo "CRITICAL - failed to query pods in namespace/$NAMESPACE: $PODS_JSON"
  exit 2
fi

PODS_JSON="$PODS_JSON" python3 - <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["PODS_JSON"])
items = payload.get("items", [])
if not items:
    print("CRITICAL - no pods found")
    sys.exit(2)

problems = []
ready_count = 0
for pod in items:
    name = pod.get("metadata", {}).get("name", "unknown")
    phase = pod.get("status", {}).get("phase", "Unknown")
    container_statuses = pod.get("status", {}).get("containerStatuses", [])
    ready = all(cs.get("ready", False) for cs in container_statuses) if container_statuses else False
    waiting_reason = None
    for cs in container_statuses:
        state = cs.get("state", {})
        if "waiting" in state:
            waiting_reason = state["waiting"].get("reason") or state["waiting"].get("message")
            break
        if "terminated" in state and state["terminated"].get("exitCode", 0) != 0:
            waiting_reason = state["terminated"].get("reason") or f"exitCode={state['terminated'].get('exitCode')}"
            break
    if phase == "Running" and ready:
        ready_count += 1
        continue
    details = waiting_reason or phase
    problems.append(f"{name}={details}")

if problems:
    print(f"CRITICAL - {ready_count}/{len(items)} pods ready; problems: {', '.join(problems[:6])}")
    sys.exit(2)

print(f"OK - all {len(items)} pods in namespace are Running and ready")
sys.exit(0)
PY
