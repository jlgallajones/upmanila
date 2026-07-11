import Svg, { Path, Rect } from "react-native-svg";

type EmergencyShieldProps = {
  size?: number;
};

export default function EmergencyShield({
  size = 112,
}: EmergencyShieldProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 120 132"
      accessibilityLabel="Emergency medical shield"
    >
      <Path
        d="
          M60 5
          L108 24
          V61
          C108 92 90 116 60 127
          C30 116 12 92 12 61
          V24
          Z
        "
        fill="#FFFFFF"
      />

      <Rect
        x="51"
        y="36"
        width="18"
        height="58"
        rx="4"
        fill="#8B1538"
      />

      <Rect
        x="31"
        y="56"
        width="58"
        height="18"
        rx="4"
        fill="#8B1538"
      />
    </Svg>
  );
}