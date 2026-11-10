import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

export function OrderAlertBackground({ overdue }: { overdue: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || !width) return;
    progress.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion, width]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {!reduceMotion &&
        width > 0 &&
        (overdue
          ? ["248, 70, 100", "245, 130, 55", "160, 75, 185"]
          : ["245, 130, 35", "250, 185, 55", "235, 95, 30"]
        ).map((color, index) => (
          <Animated.View
            key={color}
            style={[
              { position: "absolute", width: 360, height: 360 },
              {
                left: (index * width) / 3 - 100,
                top: index === 1 ? -130 : -40,
                opacity: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: index === 1 ? [0.55, 0.95] : [0.9, 0.5],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: index === 1 ? [35, -35] : [-25, 45],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: index === 1 ? [15, 65] : [40, -20],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: index === 1 ? [1.2, 0.9] : [0.9, 1.25],
                    }),
                  },
                ],
              },
            ]}
          >
            {Array.from({ length: 8 }, (_, ring) => (
              <View
                key={ring}
                style={{
                  position: "absolute",
                  top: ring * 14,
                  bottom: ring * 14,
                  left: ring * 14,
                  right: ring * 14,
                  borderRadius: 180,
                  backgroundColor: `rgba(${color}, 0.025)`,
                }}
              />
            ))}
          </Animated.View>
        ))}
    </View>
  );
}
