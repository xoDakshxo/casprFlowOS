/**
 * Shared owns cross-package contracts and tiny pure utilities.
 * It depends on no internal package and exposes no Electron, React, fs, or network APIs.
 */

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type Id<TScope extends string> = Brand<string, `${TScope}Id`>;

export const createId = <TScope extends string>(scope: TScope, value: string): Id<TScope> => {
  return `${scope}:${value}` as Id<TScope>;
};

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export type Result<TValue, TError = Error> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export const ok = <TValue>(value: TValue): Result<TValue> => ({ ok: true, value });

export const err = <TError>(error: TError): Result<never, TError> => ({
  ok: false,
  error,
});

export type SideEffectLevel = "readOnly" | "local" | "confirm";

export interface CapabilityResult<TData extends JsonObject = JsonObject> {
  readonly ok: boolean;
  readonly message: string;
  readonly data: TData;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly details: JsonObject | undefined;
}

export interface Logger {
  readonly debug: (message: string, details?: JsonObject) => void;
  readonly info: (message: string, details?: JsonObject) => void;
  readonly warn: (message: string, details?: JsonObject) => void;
  readonly error: (message: string, details?: JsonObject) => void;
}

export const createConsoleLogger = (namespace: string): Logger => {
  const write = (entry: LogEntry): void => {
    const prefix = `[${namespace}] ${entry.message}`;

    if (entry.level === "error") {
      console.error(prefix, entry.details ?? "");
      return;
    }

    if (entry.level === "warn") {
      console.warn(prefix, entry.details ?? "");
      return;
    }

    if (entry.level === "debug") {
      console.debug(prefix, entry.details ?? "");
      return;
    }

    console.info(prefix, entry.details ?? "");
  };

  return {
    debug: (message, details) => write({ level: "debug", message, details }),
    info: (message, details) => write({ level: "info", message, details }),
    warn: (message, details) => write({ level: "warn", message, details }),
    error: (message, details) => write({ level: "error", message, details }),
  };
};

export type EventMap = Record<string, unknown>;

export type Unsubscribe = () => void;

export interface EventBus<TEvents extends EventMap> {
  readonly publish: <TName extends keyof TEvents & string>(
    name: TName,
    payload: TEvents[TName],
  ) => void;
  readonly subscribe: <TName extends keyof TEvents & string>(
    name: TName,
    listener: (payload: TEvents[TName]) => void,
  ) => Unsubscribe;
}

export const createEventBus = <TEvents extends EventMap>(): EventBus<TEvents> => {
  const listeners = new Map<keyof TEvents & string, Set<(payload: unknown) => void>>();

  return {
    publish: (name, payload) => {
      const namedListeners = listeners.get(name);
      if (!namedListeners) {
        return;
      }

      for (const listener of namedListeners) {
        listener(payload);
      }
    },
    subscribe: (name, listener) => {
      const existingListeners = listeners.get(name);
      const namedListeners = existingListeners ?? new Set<(payload: unknown) => void>();
      namedListeners.add(listener as (payload: unknown) => void);
      listeners.set(name, namedListeners);

      return () => {
        namedListeners.delete(listener as (payload: unknown) => void);
        if (namedListeners.size === 0) {
          listeners.delete(name);
        }
      };
    },
  };
};
