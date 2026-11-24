import { useMemo, useRef, useState } from "react";
import { PanResponder, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNativeColors } from "@spine/ui-native";
import type { Point, Stroke } from "../lib/signature/png";
import { useT } from "../lib/i18n";

export const PEN_WIDTH = 2.5;

function pathFor(stroke: Stroke): string {
  if (stroke.length === 0) return "";
  const [first, ...rest] = stroke;
  if (rest.length === 0) return `M ${first!.x} ${first!.y} l 0.01 0`;
  return `M ${first!.x} ${first!.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

/**
 * US-MOB-17 · `MobQuoteAccept` — the box the customer signs in with a
 * finger: a dashed outline with a line to sign on. Strokes are kept as
 * points (in the box's own coordinates) so the PNG can be drawn from them
 * (D-202). `onDrawing` lets the screen stop scrolling while a finger is
 * down.
 */
export function SignaturePad({
  strokes,
  onChange,
  onSize,
  onDrawing,
  label,
  testID = "signature-pad",
}: {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  onSize: (size: { width: number; height: number }) => void;
  onDrawing?: (drawing: boolean) => void;
  label: string;
  testID?: string;
}) {
  const t = useT();
  const colors = useNativeColors();
  const [current, setCurrent] = useState<Stroke | null>(null);
  const live = useRef<{ strokes: Stroke[]; current: Stroke | null }>({ strokes, current: null });
  live.current.strokes = strokes;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const point: Point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          live.current.current = [point];
          setCurrent([point]);
          onDrawing?.(true);
        },
        onPanResponderMove: (event) => {
          const stroke = live.current.current;
          if (!stroke) return;
          const next = [...stroke, { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }];
          live.current.current = next;
          setCurrent(next);
        },
        onPanResponderRelease: () => {
          const stroke = live.current.current;
          live.current.current = null;
          setCurrent(null);
          onDrawing?.(false);
          if (stroke) onChange([...live.current.strokes, stroke]);
        },
        onPanResponderTerminate: () => {
          live.current.current = null;
          setCurrent(null);
          onDrawing?.(false);
        },
      }),
    [onChange, onDrawing],
  );

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={t("mobileApp.signaturePad.hint")}
      accessibilityValue={{ text: strokes.length ? t("mobileApp.signaturePad.signed") : t("mobileApp.signaturePad.empty") }}
      onLayout={(event: LayoutChangeEvent) => onSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      className="h-40 overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface dark:border-border-strong-dark dark:bg-surface-dark"
      {...responder.panHandlers}
    >
      <View pointerEvents="none" className="absolute bottom-8 left-5 right-5 border-b border-border-strong dark:border-border-strong-dark" />
      <Svg pointerEvents="none" width="100%" height="100%">
        {[...strokes, ...(current ? [current] : [])].map((stroke, i) => (
          <Path key={i} d={pathFor(stroke)} stroke={colors.onSurface} strokeWidth={PEN_WIDTH} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </Svg>
    </View>
  );
}
