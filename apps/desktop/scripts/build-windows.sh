#!/usr/bin/env bash
set -eo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../mobile"

if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
  echo "nvm não encontrado em $HOME/.nvm/nvm.sh." >&2
  exit 1
fi

source "$HOME/.nvm/nvm.sh"
nvm use

cd ../desktop
exec npm run dist:win -- "$@"
