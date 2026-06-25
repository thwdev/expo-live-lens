import React, { PropsWithChildren, useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, AppStateStatus, Platform, View } from "react-native";
import { captureRef } from "react-native-view-shot";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type LiveLensPayload = Record<string, JsonValue | undefined>;

export type LiveLensOptions = {
  serverUrl: string;
  screenName?: string;
  route?: string;
  routeParams?: LiveLensPayload;
  captureMode?: "manual" | "interval" | "event";
  captureIntervalMs?: number;
  commandPollIntervalMs?: number;
  captureScreenshots?: boolean;
  screenshotQuality?: number;
  captureNetwork?: boolean;
  enabled?: boolean;
  deviceName?: string;
  metadata?: LiveLensPayload;
};

type LiveLensEvent = {
  type: string;
  level?: "log" | "warn" | "error" | "info";
  screenName?: string;
  device?: string;
  payload?: LiveLensPayload;
  image?: string;
};

const MIN_CAPTURE_INTERVAL_MS = 1000;

function isDevEnabled(enabled?: boolean) {
  return enabled !== false && typeof __DEV__ !== "undefined" && __DEV__;
}

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.replace(/\/$/, "");
}

function serializeValue(value: unknown): JsonValue {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || null
    };
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function useLiveLens(options: LiveLensOptions) {
  const active = isDevEnabled(options.enabled);
  const serverUrl = useMemo(() => normalizeServerUrl(options.serverUrl), [options.serverUrl]);

  const send = useCallback(
    async (event: LiveLensEvent) => {
      if (!active || !serverUrl) {
        return;
      }

      const body: LiveLensEvent = {
        screenName: options.screenName,
        device: options.deviceName || `${Platform.OS}`,
        ...event,
        payload: {
          ...options.metadata,
          route: options.route,
          routeParams: serializeValue(options.routeParams),
          ...event.payload
        }
      };

      try {
        await fetch(`${serverUrl}/api/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(body)
        });
      } catch {
        // Avoid recursive logging if the dev server is offline.
      }
    },
    [active, options.deviceName, options.metadata, options.route, options.routeParams, options.screenName, serverUrl]
  );

  const sendEvent = useCallback(
    (type: string, payload?: LiveLensPayload) => {
      return send({ type, payload });
    },
    [send]
  );

  const requestCapture = useCallback(
    async (reason = "app-action") => {
      if (!active || !serverUrl) {
        return;
      }

      try {
        await fetch(`${serverUrl}/api/capture-request`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ reason })
        });
      } catch {
        // Avoid noisy failures while the dashboard is offline.
      }
    },
    [active, serverUrl]
  );

  return {
    active,
    send,
    sendEvent,
    requestCapture
  };
}

function useConsoleBridge(send: (event: LiveLensEvent) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    (["log", "warn", "error", "info"] as const).forEach((level) => {
      console[level] = (...args: unknown[]) => {
        original[level](...args);
        send({
          type: "console",
          level,
          payload: {
            args: args.map(serializeValue)
          }
        });
      };
    });

    return () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
      console.info = original.info;
    };
  }, [enabled, send]);
}

function useGlobalErrorBridge(send: (event: LiveLensEvent) => void, enabled: boolean) {
  useEffect(() => {
    const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ReactNativeErrorUtils }).ErrorUtils;

    if (!enabled || !errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) {
      return;
    }

    const originalHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      send({
        type: "error",
        level: "error",
        payload: {
          isFatal: Boolean(isFatal),
          error: serializeValue(error)
        }
      });
      originalHandler(error, isFatal);
    });

    return () => {
      errorUtils.setGlobalHandler?.(originalHandler);
    };
  }, [enabled, send]);
}

function useAppStateBridge(send: (event: LiveLensEvent) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleChange = (state: AppStateStatus) => {
      send({
        type: "app-state",
        payload: { state }
      });
    };

    const subscription = AppState.addEventListener("change", handleChange);
    send({
      type: "app-state",
      payload: { state: AppState.currentState }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, send]);
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function getFetchUrl(input: FetchInput) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function useNetworkBridge(
  send: (event: LiveLensEvent) => void,
  enabled: boolean,
  serverUrl: string,
  captureNetwork = true
) {
  useEffect(() => {
    if (!enabled || !captureNetwork || typeof fetch !== "function") {
      return;
    }

    const originalFetch = fetch;

    globalThis.fetch = async (input: FetchInput, init?: FetchInit) => {
      const startedAt = Date.now();
      const url = getFetchUrl(input);
      const method =
        init?.method ||
        (typeof input !== "string" && !(input instanceof URL) ? input.method : undefined) ||
        "GET";
      const shouldIgnore = url.startsWith(serverUrl);

      try {
        const response = await originalFetch(input, init);

        if (!shouldIgnore) {
          send({
            type: "network",
            payload: {
              url,
              method,
              status: response.status,
              ok: response.ok,
              durationMs: Date.now() - startedAt
            }
          });
        }

        return response;
      } catch (error) {
        if (!shouldIgnore) {
          send({
            type: "network-error",
            level: "error",
            payload: {
              url,
              method,
              durationMs: Date.now() - startedAt,
              error: serializeValue(error)
            }
          });
        }

        throw error;
      }
    };

    return () => {
      globalThis.fetch = originalFetch;
    };
  }, [captureNetwork, enabled, send, serverUrl]);
}

export function LiveLensRoot(props: PropsWithChildren<LiveLensOptions>) {
  const {
    children,
    captureMode = "manual",
    captureIntervalMs = 2500,
    commandPollIntervalMs = 1000,
    captureScreenshots = true,
    screenshotQuality = 0.58
  } = props;
  const rootRef = useRef<View>(null);
  const lens = useLiveLens(props);
  const { active, send } = lens;
  const serverUrl = useMemo(() => normalizeServerUrl(props.serverUrl), [props.serverUrl]);
  const interval = Math.max(captureIntervalMs, MIN_CAPTURE_INTERVAL_MS);

  useConsoleBridge(send, active);
  useGlobalErrorBridge(send, active);
  useAppStateBridge(send, active);
  useNetworkBridge(send, active, serverUrl, props.captureNetwork);

  useEffect(() => {
    if (!active || !captureScreenshots) {
      return;
    }

    let disposed = false;
    let captureInFlight = false;
    let latestCaptureRequestId: string | null = null;

    const capture = async (reason: CaptureReason) => {
      if (!rootRef.current || disposed || captureInFlight || AppState.currentState !== "active") {
        return;
      }

      captureInFlight = true;

      try {
        const image = await captureRef(rootRef.current, {
          format: "jpg",
          quality: screenshotQuality,
          result: "base64"
        });

        await send({
          type: "screenshot",
          image: `data:image/jpeg;base64,${image}`,
          payload: {
            width: "root",
            captureIntervalMs: interval,
            screenshotQuality,
            captureMode,
            captureReason: reason
          }
        });
      } catch (error) {
        if (!disposed) {
          await send({
            type: "screenshot-error",
            level: "warn",
            payload: {
              error: serializeValue(error)
            }
          });
        }
      } finally {
        captureInFlight = false;
      }
    };

    const timers: ReturnType<typeof setTimeout>[] = [];
    const disposers: (() => void)[] = [];
    timers.push(setTimeout(() => capture("initial"), 600));

    if (captureMode === "interval") {
      timers.push(setInterval(() => capture("interval"), interval));
    }

    if (captureMode === "event") {
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          setTimeout(() => capture("app-active"), 350);
        }
      });

      disposers.push(() => subscription.remove());
    }

    const pollCommands = async () => {
      if (disposed) {
        return;
      }

      try {
        const query = latestCaptureRequestId ? `?since=${encodeURIComponent(latestCaptureRequestId)}` : "";
        const response = await fetch(`${serverUrl}/api/capture-request${query}`);
        const data = await response.json();

        if (data.request?.id) {
          latestCaptureRequestId = data.request.id;
          await capture("manual");
        }
      } catch {
        // The dashboard may be offline; keep the app quiet.
      }
    };

    timers.push(setInterval(pollCommands, Math.max(commandPollIntervalMs, 750)));

    return () => {
      disposed = true;
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [active, captureMode, captureScreenshots, commandPollIntervalMs, interval, screenshotQuality, send, serverUrl]);

  return (
    <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
      {children}
    </View>
  );
}

type ReactNativeErrorUtils = {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

type CaptureReason = "initial" | "interval" | "manual" | "app-active";
