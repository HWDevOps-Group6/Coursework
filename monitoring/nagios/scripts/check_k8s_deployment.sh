#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'EOF'
Usage: check_k8s_deployment.sh -n <namespace> -d <deployment> [-k <kubeconfig>] [-c <kubectl>]
EOF
}

NAMESPACE=""
DEPLOYMENT=""
KUBECONFIG_PATH="${KUBECONFIG:-}"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"

while getopts ':n:d:k:c:h' opt; do
  case "$opt" in
    n) NAMESPACE="$OPTARG" ;;
    d) DEPLOYMENT="$OPTARG" ;;
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

if [[ -z "$NAMESPACE" || -z "$DEPLOYMENT" ]]; then
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

if ! DEPLOYMENT_JSON="$(${KUBECTL_ARGS[@]} -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o json 2>&1)"; then
  echo "CRITICAL - failed to query deployment/$DEPLOYMENT in namespace/$NAMESPACE: $DEPLOYMENT_JSON"
  exit 2
fi

DEPLOYMENT_JSON="$DEPLOYMENT_JSON" python3 - <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["DEPLOYMENT_JSON"])
metadata = payload.get("metadata", {})
status = payload.get("status", {})
spec = payload.get("spec", {})
name = metadata.get("name", "unknown")
desired = int(spec.get("replicas", 0) or 0)
ready = int(status.get("readyReplicas", 0) or 0)
available = int(status.get("availableReplicas", 0) or 0)
updated = int(status.get("updatedReplicas", 0) or 0)
conditions = {item.get("type"): item for item in status.get("conditions", []) if item.get("type")}
progressing = conditions.get("Progressing", {})
available_condition = conditions.get("Available", {})
progress_msg = progressing.get("message") or progressing.get("reason") or ""
avail_msg = available_condition.get("message") or available_condition.get("reason") or ""
extra = "; ".join(x for x in [progress_msg, avail_msg] if x)
summary = f"deployment/{name} ready={ready}/{desired} available={available}/{desired} updated={updated}/{desired}"

if desired == 0:
    print(f"WARNING - {summary} (replicas set to 0)")
    sys.exit(1)
if ready >= desired and available >= desired:
    suffix = f" - {extra}" if extra else ""
    print(f"OK - {summary}{suffix}")
    sys.exit(0)
if ready > 0 or updated > 0:
    suffix = f" - {extra}" if extra else ""
    print(f"WARNING - {summary}{suffix}")
    sys.exit(1)
suffix = f" - {extra}" if extra else ""
print(f"CRITICAL - {summary}{suffix}")
sys.exit(2)
PY
