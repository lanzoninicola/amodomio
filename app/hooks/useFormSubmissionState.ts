import { useNavigation } from "@remix-run/react";

export type FormSubmissionnState =
  | "idle"
  | "submitting"
  | "loading"
  | "submittingOrLoading";

export default function useFormSubmissionnState(): FormSubmissionnState {
  const navigation = useNavigation();

  if (navigation.state === "submitting") {
    return "submitting";
  }

  if (navigation.state === "loading") {
    return "loading";
  }

  return "idle";
}
