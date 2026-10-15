#!/usr/bin/env bash
# Shared destination used by scripts/build-extension.mjs.
build_drive_init() {
  build_upload=true
  build_args=()
  for arg in "$@"; do
    if [ "$arg" = --no-upload ]; then
      build_upload=false
    else
      build_args+=("$arg")
    fi
  done
  build_drive_remote="${EXTENSION_DRIVE_REMOTE:-amodomio-drive}"
  build_drive_folder="${EXTENSION_DRIVE_FOLDER_ID:-1Nj1uctv-kyEHECYeTqIKqTabKgXSEubR}"
  if ! "$build_upload"; then return; fi
  if [[ ! "$build_drive_remote" =~ ^[a-zA-Z0-9_-]+$ ]] || [[ ! "$build_drive_folder" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "EXTENSION_DRIVE_REMOTE e EXTENSION_DRIVE_FOLDER_ID devem conter apenas nome e ID, respectivamente." >&2
    return 1
  fi
  local remotes
  if ! remotes=$(rclone listremotes); then
    echo "Configure o rclone para Google Drive ou use --no-upload para gerar somente o instalador." >&2
    return 1
  fi
  if ! grep -Fxq "$build_drive_remote:" <<< "$remotes"; then
    echo "Configure o remote $build_drive_remote no rclone ou use --no-upload." >&2
    return 1
  fi
}

build_drive_upload() {
  local artifact="$1"
  if [ ! -s "$artifact" ]; then
    echo "Instalador não encontrado ou vazio: $artifact" >&2
    return 1
  fi
  echo "Instalador gerado: $artifact"
  if ! "$build_upload"; then return; fi
  # Unique remote names preserve earlier builds even with a fixed local --output.
  local name stamp
  name=$(basename "$artifact")
  stamp=$(date -u +%Y-%m-%dT%H-%M-%S)-$$
  rclone copyto "$artifact" "$build_drive_remote:${name%.*}-$stamp.${name##*.}" \
    --drive-root-folder-id "$build_drive_folder" --immutable --progress
  echo "Enviado para https://drive.google.com/drive/folders/$build_drive_folder"
}
