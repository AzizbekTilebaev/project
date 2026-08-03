#!/usr/bin/env bash
# Apertium/HFST toolchain o‘rnatish (Ubuntu WSL).
# Ishlatish: wsl -e bash scripts/apertium/00-install-deps.sh
set -euo pipefail

echo "==> apt update"
sudo apt-get update -y

echo "==> build tools + apertium deps"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential \
  autoconf \
  automake \
  libtool \
  pkg-config \
  git \
  curl \
  wget \
  zip \
  unzip \
  gawk \
  python3 \
  cmake \
  flex \
  bison \
  libicu-dev \
  zlib1g-dev \
  apertium \
  apertium-dev \
  lttoolbox \
  lttoolbox-dev \
  hfst \
  libhfst-dev \
  cg3 \
  vislcg3

echo "==> versions"
hfst-lexc --version 2>&1 | head -1 || true
hfst-twolc --version 2>&1 | head -1 || true
lt-proc --version 2>&1 | head -1 || true
apertium --version 2>&1 | head -1 || true

echo "==> DONE: deps installed"
