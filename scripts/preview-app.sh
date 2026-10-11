#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "${1:-}" in
  android)
    APP_DIR="$PROJECT_ROOT/apps/mobile"
    APP_SCRIPT="web"
    ;;
  android-native)
    APP_DIR="$PROJECT_ROOT/apps/mobile"
    APP_SCRIPT="android"
    export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
    export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
    ;;
  desktop)
    APP_DIR="$PROJECT_ROOT/apps/desktop"
    APP_SCRIPT="start"
    ;;
  *)
    echo "Uso: bash scripts/preview-app.sh android|android-native|desktop [argumentos]" >&2
    exit 1
    ;;
esac
shift
cd "$APP_DIR"

unset npm_config_prefix NPM_CONFIG_PREFIX
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "nvm não encontrado em $NVM_DIR/nvm.sh. Instale o nvm para executar a prévia." >&2
  exit 1
fi
source "$NVM_DIR/nvm.sh" --no-use
nvm use

exec npm run "$APP_SCRIPT" -- "$@"
