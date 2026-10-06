import { Button } from "./Button";
export function IconButton({
  label,
  onPress,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
}) {
  return <Button onPress={onPress}>{label}</Button>;
}
