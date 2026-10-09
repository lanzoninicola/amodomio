#!/usr/bin/env bash
set -eo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
  echo "nvm não encontrado em $HOME/.nvm/nvm.sh." >&2
  exit 1
fi

# npm run exports a prefix that can conflict with nvm's Node activation.
unset npm_config_prefix NPM_CONFIG_PREFIX
source "$HOME/.nvm/nvm.sh" --no-use
if ! nvm use; then
  echo "Não foi possível ativar o Node indicado em apps/mobile/.nvmrc. Execute nvm install nessa pasta." >&2
  exit 1
fi

android_sdk_path="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$android_sdk_path" ]; then
  for candidate in "$HOME/Android/Sdk" "$HOME/Android/sdk" /opt/android-sdk /usr/lib/android-sdk; do
    if [ -d "$candidate" ]; then
      android_sdk_path="$candidate"
      break
    fi
  done
fi

if [ -z "$android_sdk_path" ] || [ ! -d "$android_sdk_path/platforms" ] || [ ! -d "$android_sdk_path/build-tools" ]; then
  echo "Android SDK não encontrado ou incompleto. Instale pelo Android Studio (SDK Manager)." >&2
  echo "Pacotes: Android SDK Platform 36, Build-Tools 36.0.0 e NDK 27.1.12297006." >&2
  echo "Se estiver em outra pasta, defina ANDROID_HOME com o caminho do SDK." >&2
  exit 1
fi

export ANDROID_HOME="$android_sdk_path"
export ANDROID_SDK_ROOT="$android_sdk_path"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

exec npx --no-install eas build --platform android --profile preview --local "$@"
