import { useRouter } from "expo-router";
import { WelcomeScreen } from "../src/features/welcome/welcome-screen";
import { useWelcome } from "../src/lib/welcome/welcome-seen";

/** US-MOB-26 — "Get started" opens Sign in, and Welcome is never shown on this phone again. */
export default function Welcome() {
  const router = useRouter();
  const { markSeen } = useWelcome();
  return (
    <WelcomeScreen
      onGetStarted={() => {
        router.replace("/sign-in");
        markSeen();
      }}
    />
  );
}
