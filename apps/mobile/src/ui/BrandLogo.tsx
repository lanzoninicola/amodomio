import { Image } from "react-native";

export function BrandLogo({
  light = false,
  width = 156,
}: {
  light?: boolean;
  width?: number;
}) {
  return (
    <Image
      source={
        light
          ? require("../../assets/logo-horizontal-white.png")
          : require("../../assets/logo-horizontal-black.png")
      }
      accessibilityLabel="A Modo Mio"
      accessible
      resizeMode="contain"
      style={{ width, height: (width * 261) / 2007 }}
    />
  );
}
