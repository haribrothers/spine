import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import X from "lucide-react-native/icons/x";
import { useT } from "../lib/i18n";
import { lightColors } from "../tokens";

export interface ToastMessage {
  title: string;
  description?: string;
}

export interface ToastProps extends ToastMessage {
  onDismiss: () => void;
}

/**
 * Ports `packages/ui`'s Toast — dark chrome, auto-dismissing, confirms an
 * action succeeded. Never carries a validation error (that stays an inline
 * concern once this package has a HelperText equivalent).
 *
 * There's no Radix Toast primitive to wrap here (no swipe-to-dismiss
 * gesture, no shared queue/viewport the way web's `ToastProvider` manages)
 * — `useToast` below is the RN port of web's own `useEntityToast` pattern
 * (apps/web/.../entity-toast.tsx): a single-message-at-a-time hook, not a
 * multi-toast queue, since that's the pattern web itself actually uses
 * per-screen rather than a shared global queue.
 *
 * Colors are the RAW light-mode `neutral900`/`neutral50` values, not
 * `bg-neutral-900 dark:bg-neutral-900-dark` — this chrome must stay dark
 * regardless of the app's own light/dark theme, but `neutral900` itself is
 * theme-REACTIVE (it flips to near-white in dark mode, see
 * `tokens/colors.ts`). Pairing a theme-reactive dark value with hardcoded
 * light text collapses contrast in dark mode — the exact bug web's own
 * Toast doc comment describes fixing with dedicated `inverse-*` tokens.
 * This component resolves the same fix without adding new shared tokens
 * for a single consumer: it reads `lightColors.neutral900`/`neutral50`
 * directly, bypassing the theme switch entirely.
 */
export function Toast({ title, description, onDismiss }: ToastProps) {
  const t = useT();
  return (
    <View
      style={{ backgroundColor: lightColors.neutral900 }}
      className="flex-row items-center justify-between gap-3 rounded-md px-3.5 py-2.5 shadow-lg"
    >
      <View className="flex-1 gap-0.5">
        <Text style={{ color: lightColors.neutral50 }} className="text-[13px] font-medium">
          {title}
        </Text>
        {description ? (
          <Text style={{ color: lightColors.neutral300 }} className="text-[12px]">
            {description}
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("uiNative.toast.dismiss")} onPress={onDismiss} hitSlop={8}>
        <X size={14} color={lightColors.neutral300} />
      </Pressable>
    </View>
  );
}

/**
 * Single-message toast state, matching web's `useEntityToast` shape:
 * `show(title, description)` displays a message for `duration` ms, then
 * auto-dismisses. Calling `show` again while a toast is visible replaces
 * the message and resets the timer, rather than queuing a second toast.
 */
export function useToast(duration = 2500) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(null);
  }, []);

  const show = useCallback(
    (title: string, description?: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMessage({ title, description });
      timeoutRef.current = setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { message, show, dismiss };
}
