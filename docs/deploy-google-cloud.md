# Deploying DOOEY to Google Cloud

DOOEY deploys as **one Docker container**: PocketBase serves the API, realtime SSE,
*and* the built web app (`dist/` → `pb_public`). SQLite is the database, so the one
thing production must provide is a **real persistent disk** — which is why the
recommended target is a **Compute Engine VM**, not Cloud Run.

> **Why not Cloud Run?** Its filesystem is ephemeral and its volume options (GCS
> FUSE / Filestore) are network filesystems, which PocketBase explicitly warns
> against for SQLite (locking + corruption risk). A tiny VM with a persistent disk
> is the boring, correct home for this app — and an `e2-micro` in
> `us-central1` / `us-west1` / `us-east1` falls under GCP's always-free tier.

Everything below assumes the `gcloud` CLI is authenticated and a project is set:

```bash
gcloud config set project <PROJECT_ID>
```

Pick a region/zone once and stick to it (examples use `us-central1` / `us-central1-a`).

## 1. Build and push the image

```bash
gcloud artifacts repositories create dooey \
  --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -t us-central1-docker.pkg.dev/<PROJECT_ID>/dooey/dooey:latest .
docker push us-central1-docker.pkg.dev/<PROJECT_ID>/dooey/dooey:latest
```

No build args needed: the web app defaults to same-origin in production, so the
image is domain-agnostic.

## 2. Create the persistent disk + VM

```bash
gcloud compute disks create dooey-data \
  --size=10GB --type=pd-standard --zone=us-central1-a

gcloud compute instances create-with-container dooey \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --tags=http-server,https-server \
  --container-image=us-central1-docker.pkg.dev/<PROJECT_ID>/dooey/dooey:latest \
  --container-command=./pocketbase \
  --container-arg=serve \
  --container-arg=<YOUR_DOMAIN> \
  --container-arg=--http=0.0.0.0:80 \
  --container-arg=--https=0.0.0.0:443 \
  --disk=name=dooey-data,device-name=dooey-data,mode=rw,auto-delete=no \
  --container-mount-disk=name=dooey-data,mount-path=/pb/pb_data
```

- `--container-mount-disk` auto-formats the blank disk on first boot and mounts it
  over `/pb/pb_data`, so the database outlives the VM and the container.
- The `http-server`/`https-server` tags open ports 80/443 via the default-network
  firewall rules.
- Passing your domain to `pocketbase serve` turns on **automatic Let's Encrypt** —
  no reverse proxy needed. (No domain yet? Serve plain HTTP on 80 with just
  `--container-arg=serve --container-arg=--http=0.0.0.0:80` until you have one.)

## 3. Point DNS at a static IP

```bash
gcloud compute addresses create dooey-ip --region=us-central1
gcloud compute instances delete-access-config dooey --zone=us-central1-a
gcloud compute instances add-access-config dooey --zone=us-central1-a \
  --address=$(gcloud compute addresses describe dooey-ip --region=us-central1 --format='value(address)')
```

Create an **A record** for `<YOUR_DOMAIN>` → that IP. The first HTTPS request
triggers the Let's Encrypt issue (needs DNS to already resolve).

## 4. First-run setup

Create the PocketBase superuser from inside the VM, then sign into the dashboard:

```bash
gcloud compute ssh dooey --zone=us-central1-a
docker ps                                  # find the dooey container id
docker exec -it <CONTAINER_ID> ./pocketbase superuser upsert <email> <password>
```

Dashboard: `https://<YOUR_DOMAIN>/_/` — migrations from `pb/pb_migrations` have
already auto-applied on first start. Create your user account, and the app itself
is at `https://<YOUR_DOMAIN>/`.

## 5. Ship an update

```bash
docker build -t us-central1-docker.pkg.dev/<PROJECT_ID>/dooey/dooey:latest .
docker push us-central1-docker.pkg.dev/<PROJECT_ID>/dooey/dooey:latest
gcloud compute instances update-container dooey --zone=us-central1-a \
  --container-image=us-central1-docker.pkg.dev/<PROJECT_ID>/dooey/dooey:latest
```

`pb_data` lives on the mounted disk, so updates never touch data.

## 6. Backups

Two independent layers, both cheap:

- **Disk snapshots** (whole-disk, scheduled):
  ```bash
  gcloud compute resource-policies create snapshot-schedule dooey-nightly \
    --region=us-central1 --max-retention-days=14 \
    --daily-schedule --start-time=04:00
  gcloud compute disks add-resource-policies dooey-data \
    --zone=us-central1-a --resource-policies=dooey-nightly
  ```
- **PocketBase backups** (app-consistent ZIPs): Dashboard → Settings → Backups.
  These can also upload to a GCS bucket via its S3-compatible API (HMAC key).

## Native apps against production

Point the shells at the deployed host when building:

```bash
VITE_PB_URL=https://<YOUR_DOMAIN> npm run mobile:sync
```
