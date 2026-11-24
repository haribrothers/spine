import { useRef } from "react";
import { Animated, Image, PanResponder, Pressable, type AccessibilityActionEvent } from "react-native";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const CLOSE_DISTANCE = 100;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * US-MOB-30 — one photo in the viewer: pinch or double-tap to zoom, pan
 * the zoomed photo, double-tap again to fit; swipe down (not zoomed) to
 * close. Built on React Native's own PanResponder and Animated, so it needs
 * no native gesture module. While zoomed it tells the pager to stop paging.
 * With Reduce Motion on, zoom changes jump instead of animating.
 */
export function ZoomablePhoto({
  uri,
  label,
  width,
  height,
  reduceMotion,
  onZoomChange,
  onClose,
  accessibilityActions,
  onAccessibilityAction,
  testID,
}: {
  uri: string;
  label: string;
  width: number;
  height: number;
  reduceMotion: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onClose: () => void;
  accessibilityActions: { name: string; label: string }[];
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
  testID?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const live = useRef({ scale: 1, tx: 0, ty: 0, startScale: 1, startTx: 0, startTy: 0, startDistance: 0, lastTap: 0 }).current;

  const bounds = (s: number) => ({ x: (width * (s - 1)) / 2, y: (height * (s - 1)) / 2 });

  function moveTo(nextScale: number, nextTx: number, nextTy: number, animate: boolean) {
    const b = bounds(nextScale);
    live.scale = nextScale;
    live.tx = clamp(nextTx, -b.x, b.x);
    live.ty = clamp(nextTy, -b.y, b.y);
    if (animate && !reduceMotion) {
      Animated.parallel([
        Animated.spring(scale, { toValue: live.scale, useNativeDriver: true, bounciness: 0 }),
        Animated.spring(tx, { toValue: live.tx, useNativeDriver: true, bounciness: 0 }),
        Animated.spring(ty, { toValue: live.ty, useNativeDriver: true, bounciness: 0 }),
      ]).start();
    } else {
      scale.setValue(live.scale);
      tx.setValue(live.tx);
      ty.setValue(live.ty);
    }
    onZoomChange(live.scale > 1);
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event, gesture) =>
        event.nativeEvent.touches.length === 2 || live.scale > 1 || (gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5),
      onPanResponderGrant: () => {
        live.startScale = live.scale;
        live.startTx = live.tx;
        live.startTy = live.ty;
        live.startDistance = 0;
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;
        if (touches.length === 2) {
          const distance = Math.hypot(touches[0]!.pageX - touches[1]!.pageX, touches[0]!.pageY - touches[1]!.pageY);
          if (!live.startDistance) {
            live.startDistance = distance;
            live.startScale = live.scale;
            return;
          }
          live.scale = clamp((live.startScale * distance) / live.startDistance, 1, MAX_SCALE);
          scale.setValue(live.scale);
        } else if (live.scale > 1) {
          const b = bounds(live.scale);
          live.tx = clamp(live.startTx + gesture.dx, -b.x, b.x);
          live.ty = clamp(live.startTy + gesture.dy, -b.y, b.y);
          tx.setValue(live.tx);
          ty.setValue(live.ty);
        } else if (gesture.dy > 0) {
          // Not zoomed: the photo follows the finger down, to close.
          ty.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_event, gesture) => {
        if (live.scale <= 1 && live.startDistance === 0 && gesture.dy > CLOSE_DISTANCE) {
          onClose();
          return;
        }
        moveTo(live.scale <= 1.05 ? 1 : live.scale, live.scale <= 1.05 ? 0 : live.tx, live.scale <= 1.05 ? 0 : live.ty, true);
      },
      onPanResponderTerminationRequest: () => live.scale <= 1,
    }),
  ).current;

  function onTap() {
    const now = Date.now();
    if (now - live.lastTap < DOUBLE_TAP_MS) {
      live.lastTap = 0;
      if (live.scale > 1) moveTo(1, 0, 0, true);
      else moveTo(DOUBLE_TAP_SCALE, 0, 0, true);
    } else {
      live.lastTap = now;
    }
  }

  return (
    <Animated.View {...responder.panHandlers} style={{ width, height, overflow: "hidden" }}>
      <Pressable
        onPress={onTap}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
        testID={testID}
        style={{ width, height }}
      >
        <Animated.View style={{ width, height, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
          <Image source={{ uri }} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
