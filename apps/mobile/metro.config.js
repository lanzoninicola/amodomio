const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// This app installs dependencies independently of the web app.
config.watchFolders = [path.resolve(__dirname, "../../shared")];

module.exports = config;
