#!/usr/bin/env bash
set -eo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
  echo "nvm não encontrado em $HOME/.nvm/nvm.sh." >&2
  exit 1
fi

# npm run exports its prefix, which conflicts with nvm's Node activation.
# Clear it only in this build process, preserving the caller's configuration.
unset npm_config_prefix NPM_CONFIG_PREFIX
source "$HOME/.nvm/nvm.sh" --no-use
if ! nvm use; then
  echo "Não foi possível ativar o Node indicado em apps/desktop/.nvmrc. Execute nvm install nessa pasta." >&2
  exit 1
fi

source ../../scripts/build-drive.sh
build_drive_init "$@"
# Isolate this run so old installers cannot be uploaded after a successful build.
windows_output="$PWD/release/build-$(date -u +%Y-%m-%dT%H-%M-%S)-$$"
npm run dist:win -- "${build_args[@]}" --config.directories.output="$windows_output"
shopt -s nullglob
windows_installers=("$windows_output/"*.exe)
if [ "${#windows_installers[@]}" -eq 0 ]; then
  echo "Nenhum instalador .exe gerado em $windows_output." >&2
  exit 1
fi
for installer in "${windows_installers[@]}"; do
  build_drive_upload "$installer"
done
