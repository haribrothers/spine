import { useState } from "react";
import { Image, Text, View, type ViewProps, type ImageSourcePropType } from "react-native";
import { cn } from "../lib/cn";

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

const textSizeClasses = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[15px]",
} as const;

export interface AvatarProps extends ViewProps {
  size?: keyof typeof sizeClasses;
  source?: ImageSourcePropType;
  fallback: string;
}

/**
 * Ports `packages/ui`'s Avatar/AvatarImage/AvatarFallback compound to a
 * single RN component — there's no Radix primitive being wrapped here (RN
 * has no `@radix-ui/react-avatar` equivalent), so the compound API that
 * exists on web purely to satisfy Radix's own composition model collapses
 * to plain `source`/`fallback` props: a circular, initials-on-primary-fill
 * placeholder by default, or the image once it loads. Falls back
 * automatically on a load error via `Image`'s own `onError`, the RN
 * equivalent of Radix's `AvatarImage` load-failure behavior.
 */
export function Avatar({ size = "md", source, fallback, className, ...props }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = source && !imageFailed;

  return (
    <View
      className={cn(
        "shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary dark:bg-primary-dark",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {showImage ? (
        <Image source={source} className="h-full w-full" resizeMode="cover" onError={() => setImageFailed(true)} />
      ) : (
        <Text className={cn("font-semibold text-white", textSizeClasses[size])}>{fallback}</Text>
      )}
    </View>
  );
}
