# Nagios Monitoring for Coursework

This directory contains a Nagios Core starter setup for the current Azure VM + Jenkins + AKS deployment model.

## What it monitors

- Jenkins VM health from the Nagios host itself
- AKS pod health in the `coursework` namespace
- AKS deployment readiness for:
  - `auth-service`
  - `patient-service`
  - `vitals-service`
  - `gateway`
- Gateway health through the live cluster service

The checks are designed around the current application behavior in [src/gateway.js](../src/gateway.js) and the current Kubernetes manifests in [k8s](../k8s).

## Files

- [commands.cfg](commands.cfg): custom Nagios command definitions
- [objects/contacts.cfg](objects/contacts.cfg): sample email contact and contact group
- [objects/coursework-host.cfg](objects/coursework-host.cfg): Nagios host entry for the Jenkins VM
- [objects/coursework-services.cfg](objects/coursework-services.cfg): service checks for VM, AKS, and gateway
- [scripts/check_k8s_pods.sh](scripts/check_k8s_pods.sh): namespace pod health check
- [scripts/check_k8s_deployment.sh](scripts/check_k8s_deployment.sh): deployment readiness check
- [scripts/check_gateway_health.sh](scripts/check_gateway_health.sh): gateway + backend health check

## Assumptions

- Nagios Core will run on the existing Jenkins Azure VM.
- `kubectl` works on that VM using the AKS kubeconfig you already validated.
- The working kubeconfig will be stored at `/etc/nagios4/aks-coursework.kubeconfig`.
- The `kubectl` binary is available at `/snap/bin/kubectl`.
- Email alerting will be configured through Nagios contacts.

## Install outline on Ubuntu / Debian

1. Install Nagios Core and standard plugins.
2. Copy the working kubeconfig to `/etc/nagios4/aks-coursework.kubeconfig`.
3. Copy the custom scripts into the Nagios plugin directory.
4. Copy the Nagios config fragments into the Nagios config directory.
5. Update the contact email address.
6. Validate and restart Nagios.

## Example installation steps

```bash
sudo apt update
sudo apt install -y nagios4 monitoring-plugins monitoring-plugins-contrib curl python3

sudo install -d -m 0755 /usr/lib/nagios/plugins/coursework
sudo install -m 0755 monitoring/nagios/scripts/check_k8s_pods.sh /usr/lib/nagios/plugins/coursework/
sudo install -m 0755 monitoring/nagios/scripts/check_k8s_deployment.sh /usr/lib/nagios/plugins/coursework/
sudo install -m 0755 monitoring/nagios/scripts/check_gateway_health.sh /usr/lib/nagios/plugins/coursework/

sudo install -d -m 0755 /etc/nagios4/conf.d/coursework
sudo cp monitoring/nagios/commands.cfg /etc/nagios4/conf.d/coursework/
sudo cp monitoring/nagios/objects/contacts.cfg /etc/nagios4/conf.d/coursework/
sudo cp monitoring/nagios/objects/coursework-host.cfg /etc/nagios4/conf.d/coursework/
sudo cp monitoring/nagios/objects/coursework-services.cfg /etc/nagios4/conf.d/coursework/

sudo cp ~/coursework-kubeconfig /etc/nagios4/aks-coursework.kubeconfig
sudo chown root:nagios /etc/nagios4/aks-coursework.kubeconfig
sudo chmod 0640 /etc/nagios4/aks-coursework.kubeconfig

sudo editor /etc/nagios4/conf.d/coursework/contacts.cfg
sudo nagios4 -v /etc/nagios4/nagios.cfg
sudo systemctl restart nagios4
```

## How the checks work

### AKS pod check

[check_k8s_pods.sh](scripts/check_k8s_pods.sh) checks that all pods in the `coursework` namespace are `Running` and all containers are ready.

### Deployment readiness check

[check_k8s_deployment.sh](scripts/check_k8s_deployment.sh) checks each deployment's desired, updated, ready, and available replica counts.

### Gateway health check

[check_gateway_health.sh](scripts/check_gateway_health.sh) starts a short-lived `kubectl port-forward` to the `gateway` service and calls `/health`. The check returns `CRITICAL` if any backend is reported as down.

This is important because the gateway currently returns HTTP 200 even when a backend is unhealthy, so simple HTTP status checks are not enough.

## Manual validation commands

Run these before enabling the services in Nagios:

```bash
/usr/lib/nagios/plugins/coursework/check_k8s_pods.sh -n coursework -k /etc/nagios4/aks-coursework.kubeconfig -c /snap/bin/kubectl
/usr/lib/nagios/plugins/coursework/check_k8s_deployment.sh -n coursework -d gateway -k /etc/nagios4/aks-coursework.kubeconfig -c /snap/bin/kubectl
/usr/lib/nagios/plugins/coursework/check_gateway_health.sh -n coursework -s gateway -k /etc/nagios4/aks-coursework.kubeconfig -c /snap/bin/kubectl -p 18080 -r 80
```

## From your side

You still need to provide:

- the final recipient email address for alerts
- the final kubeconfig file to place at `/etc/nagios4/aks-coursework.kubeconfig`
- confirmation that Nagios may run on the Jenkins VM with access to `/snap/bin/kubectl`