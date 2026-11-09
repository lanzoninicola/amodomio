import { View } from "react-native";

export function OrderDeliveryIcon({ takeAway }: { takeAway: boolean }) {
  return (
    <View
      accessibilityLabel={takeAway ? "Balcão / retirada" : "Entrega"}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <View accessible={false} style={{ width: 28, height: 28 }}>
        {takeAway ? (
          <>
            <View
              style={{
                position: "absolute",
                left: 9,
                top: 2,
                width: 10,
                height: 12,
                borderWidth: 2,
                borderColor: "#fff",
                borderRadius: 6,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 4,
                top: 8,
                width: 20,
                height: 18,
                borderWidth: 2,
                borderColor: "#fff",
                borderRadius: 2,
                backgroundColor: "#282828",
              }}
            />
          </>
        ) : (
          <>
            <View
              style={{
                position: "absolute",
                left: 1,
                bottom: 1,
                width: 9,
                height: 9,
                borderWidth: 2,
                borderColor: "#fff",
                borderRadius: 5,
              }}
            />
            <View
              style={{
                position: "absolute",
                right: 1,
                bottom: 1,
                width: 9,
                height: 9,
                borderWidth: 2,
                borderColor: "#fff",
                borderRadius: 5,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 5,
                top: 14,
                width: 17,
                height: 7,
                borderBottomWidth: 3,
                borderLeftWidth: 3,
                borderColor: "#fff",
                borderRadius: 3,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 2,
                top: 10,
                width: 12,
                height: 3,
                backgroundColor: "#fff",
                borderRadius: 2,
              }}
            />
            <View
              style={{
                position: "absolute",
                right: 6,
                top: 5,
                width: 3,
                height: 14,
                backgroundColor: "#fff",
                transform: [{ rotate: "-20deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                right: 6,
                top: 4,
                width: 8,
                height: 3,
                backgroundColor: "#fff",
                borderRadius: 2,
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}
