#!/usr/bin/env bash
# apertium-kaa ni clone + compile qiladi.
# Natija: ~/apertium-kaa/kaa.automorf.hfst (+ .bin)
# Ishlatish: wsl -e bash scripts/apertium/01-build-kaa.sh
set -euo pipefail

# Windows path → WSL path (scripts/apertium dan chaqirilganda)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# backend/tmp/apertium — Windows bilan umumiy (wslpath orqali)
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$BACKEND_DIR/tmp/apertium"
SRC_DIR="${APERTIUM_KAA_SRC:-$HOME/apertium-kaa}"

mkdir -p "$OUT_DIR"

echo "==> source: $SRC_DIR"
if [[ ! -d "$SRC_DIR/.git" ]]; then
  echo "==> cloning apertium-kaa"
  git clone --depth 1 https://github.com/apertium/apertium-kaa.git "$SRC_DIR"
else
  echo "==> already cloned; pulling"
  git -C "$SRC_DIR" pull --ff-only || true
fi

cd "$SRC_DIR"

# Windows checkout’da PRN.prefix.dix muammosi bo‘lgani uchun
# WSL ichida toza Linux clone ishlatamiz (yuqorida).
if [[ ! -f configure ]]; then
  echo "==> autogen"
  ./autogen.sh
fi

if [[ ! -f Makefile ]]; then
  echo "==> configure"
  ./configure
fi

echo "==> make (bu 5–20 daqiqa olishi mumkin)"
make -j"$(nproc)"

echo "==> copying artifacts to $OUT_DIR"
cp -f kaa.automorf.hfst "$OUT_DIR/" 2>/dev/null || true
cp -f kaa.automorf.bin  "$OUT_DIR/" 2>/dev/null || true
cp -f kaa.autogen.hfst  "$OUT_DIR/" 2>/dev/null || true
cp -f kaa.autogen.bin   "$OUT_DIR/" 2>/dev/null || true
# debug/lexc fst (ixtiyoriy)
cp -f .deps/kaa.LR.hfst "$OUT_DIR/kaa.LR.hfst" 2>/dev/null || true

ls -lh "$OUT_DIR"/kaa.automorf.* 2>/dev/null || {
  echo "ERROR: kaa.automorf.* topilmadi — make logini tekshiring"
  exit 1
}

echo "==> smoke test"
printf 'kitapqa\nkelgen\nbilezigi\n' | hfst-proc -w "$OUT_DIR/kaa.automorf.hfst" || \
  printf 'kitapqa\nkelgen\nbilezigi\n' | lt-proc -w "$OUT_DIR/kaa.automorf.bin"

echo "==> DONE: transducer ready at $OUT_DIR"
