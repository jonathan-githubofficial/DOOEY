# DOOEY ships as ONE container: PocketBase serves the API *and* the built web
# app (dist/ is copied to pb_public, which PocketBase serves automatically).
# Hosting steps live in docs/deploy-google-cloud.md.

# --- 1. build the web app ---------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Leave VITE_PB_URL empty for the same-origin default (src/lib/pb.ts) — the
# web app talks to the PocketBase that served it. Set it only if the API will
# live on a different host than the web app.
ARG VITE_PB_URL=
ENV VITE_PB_URL=$VITE_PB_URL
RUN npm run build

# --- 2. fetch the PocketBase server binary -----------------------------------
FROM alpine:3.22 AS fetch
# 0.39.7 matches pb/pocketbase.exe — the version the migrations were written
# and tested against. Bump both together.
ARG PB_VERSION=0.39.7
ARG TARGETARCH=amd64
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip /tmp/pb.zip
RUN apk add --no-cache unzip && unzip /tmp/pb.zip -d /pb

# --- 3. runtime ---------------------------------------------------------------
FROM alpine:3.22
# ca-certificates: outbound HTTPS (Let's Encrypt, calendar sync hook)
RUN apk add --no-cache ca-certificates
WORKDIR /pb
COPY --from=fetch /pb/pocketbase ./pocketbase
COPY pb/pb_hooks ./pb_hooks
COPY pb/pb_migrations ./pb_migrations
COPY --from=web /app/dist ./pb_public

# SQLite lives here — always mount a real persistent disk over it in production.
VOLUME /pb/pb_data

EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1

# For automatic Let's Encrypt on a public host, override with:
#   ./pocketbase serve yourdomain.com --http=0.0.0.0:80 --https=0.0.0.0:443
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
