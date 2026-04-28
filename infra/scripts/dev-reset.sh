#!/usr/bin/env sh
set -eu

docker compose -f infra/compose.yaml down -v
docker compose -f infra/compose.yaml up -d
