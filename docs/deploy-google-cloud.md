# Deploying DOOEY to Google Cloud (the simple way)

One free-forever `e2-micro` VM, Docker, and this repo. No container registry, no
CI, no service accounts — you SSH in, build the image on the box, and run it.
Updating later is `git pull` + one command.

The app is one container: PocketBase serves the API, realtime, *and* the built
web app, with SQLite on the VM's disk. Everything here stays inside GCP's
always-free tier — see [Staying at $0](#staying-at-0) at the bottom.

Most steps are clicks in the [Cloud console](https://console.cloud.google.com);
the deploy itself is a handful of commands you paste into the VM's SSH window.

---

## 1. Create the VM

**Navigation menu → Compute Engine → VM instances → Create instance**
(enable the Compute Engine API if prompted):

1. Name `dooey` · Region **us-central1** · Zone **us-central1-a**.
2. Machine configuration: series **E2** → machine type **e2-micro**.
3. **OS and storage → Change**: Operating system **Ubuntu**, version
   **Ubuntu 24.04 LTS (x86/amd64)**, Boot disk type **Standard persistent
   disk**, Size **30 GB** → Select.
4. **Networking**: tick **Allow HTTP traffic** and **Allow HTTPS traffic**;
   expand the network interface and set **Network Service Tier → Standard**.
5. **Create**.

> No separate data disk: SQLite lives in a Docker volume on this 30 GB boot
> disk, which is plenty for one user and stays within the free 30 GB limit.

## 2. Reserve the IP + point a domain at it

1. **Navigation menu → VPC network → IP addresses**: find the row for `dooey`'s
   external address → **⋮ → Promote to static IP**, name it `dooey-ip`. (An
   *attached* static IP is free; only idle ones are billed.)
2. Get a free domain at [duckdns.org](https://www.duckdns.org) — sign in, create
   a subdomain (e.g. `yourname-dooey`), and set its IP to the VM's address.
   PocketBase needs a real domain for automatic HTTPS.

## 3. Set up the VM (one time)

On the VM row click **SSH** — a browser terminal opens. Paste these blocks:

```bash
# Docker + git
curl -fsSL https://get.docker.com | sudo sh
sudo apt-get update && sudo apt-get install -y git

# 2 GB swap so the web build doesn't run out of RAM on the tiny VM
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 4. Deploy

```bash
git clone https://github.com/jonathan-githubofficial/DOOEY.git
cd DOOEY
echo "DOOEY_DOMAIN=yourname-dooey.duckdns.org" > .env
sudo docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes a few minutes (it compiles the web app and fetches
PocketBase). When it finishes, open `https://yourname-dooey.duckdns.org` — the
first request triggers the Let's Encrypt certificate, then the login page loads.

> No domain yet? Test over plain HTTP first: `echo "DOOEY_DOMAIN=" > .env`, then
> in `docker-compose.prod.yml` the `--https` line is harmless but unused — visit
> `http://<VM-IP>`. Add the domain and re-run step 4 once you have one.

## 5. Create your account

```bash
sudo docker compose -f docker-compose.prod.yml exec dooey \
  ./pocketbase superuser upsert <email> <password>
```

- App: `https://<your-domain>/` → sign up on the login page.
- PocketBase dashboard: `https://<your-domain>/_/` (migrations already applied).

## 6. Ship an update

Manually, that's:

```bash
cd DOOEY && git pull
sudo docker compose -f docker-compose.prod.yml up -d --build
```

`pb_data` is a named volume, so rebuilds never touch your data. Expect ~1 minute
of downtime while the container swaps. The next section automates exactly this.

## 7. Auto-deploy on push to `main` (optional)

Every push to `main` can run that update for you. A GitHub Action SSHes into the
VM and rebuilds — the VM still builds the image, so there's no registry or cloud
credential involved, just an SSH key. The workflow is
[.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

**On the VM** (browser SSH), make a deploy key and authorize it:

```bash
ssh-keygen -t ed25519 -f ~/dooey-deploy -N "" -C github-actions
cat ~/dooey-deploy.pub >> ~/.ssh/authorized_keys
whoami            # ← this is your DEPLOY_USER
cat ~/dooey-deploy   # ← copy ALL of this (the private key) for the secret below
rm ~/dooey-deploy ~/dooey-deploy.pub
```

**In GitHub** → repo **Settings → Secrets and variables → Actions → New
repository secret**, add three:

- `DEPLOY_HOST` — the VM's static IP (from step 2)
- `DEPLOY_USER` — the `whoami` output above
- `DEPLOY_SSH_KEY` — the full private key you copied (including the
  `-----BEGIN…` / `…END-----` lines)

Push to `main` (or Actions tab → **Deploy → Run workflow**) and watch it deploy.
The Action prunes the old image each run so the 30 GB disk doesn't fill up.

> Assumes the project isn't using **OS Login** (off by default) — that's what
> makes `~/.ssh/authorized_keys` authoritative. If your repo is **private**, the
> VM's `git pull` also needs read access: add a read-only deploy key to the repo
> and clone via SSH instead of HTTPS.

## 8. Backups

PocketBase dashboard → **Settings → Backups** → download a ZIP (or schedule
them, optionally to a storage bucket). That's the whole database in one file —
enough for a personal app. For a belt-and-braces copy, `scp` the file off the VM.

---

## Staying at $0

The config above is already inside the always-free tier; the rules that keep it
there:

- **One `e2-micro`** in `us-west1` / `us-central1` / `us-east1` only.
- **Standard persistent disk**, ≤ 30 GB total (we use exactly 30).
- **Standard network tier**, and ≤ 1 GB egress/month (trivial for one user).
- **Static IP stays attached** to the running VM.

GCP has **no hard spending cap** — a budget only emails you. So the moment you
have a paid billing account, set a **$1 budget alert** (Billing → Budgets &
alerts → Create budget → $1) to hear about any non-free usage while it's still
cents. During the $300 / 90-day free trial you can't be charged at all —
resources just pause if credits run out.

## Native apps against production

```bash
VITE_PB_URL=https://<your-domain> npm run mobile:sync
```
