const { withAndroidManifest } = require("expo/config-plugins");

// The development shortcut and manually entered LAN servers use HTTP.
module.exports = function withDevelopmentHttp(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) application.$["android:usesCleartextTraffic"] = "true";
    return config;
  });
};
