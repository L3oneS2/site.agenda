"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Notifica quando o payload está pronto (use o setter de `useState` ou `useCallback` estável). */
  onReadyChange?: (ready: boolean) => void;
};

const MAX_DEVICE_PAYLOAD_BYTES = 2048;

/** Sinais estáveis do browser; o hash seguro com pepper ocorre apenas no servidor. */
export function DevicePayloadField({ onReadyChange }: Props) {
  const [json, setJson] = useState("");
  const readyCb = useRef(onReadyChange);
  readyCb.current = onReadyChange;

  useEffect(() => {
    readyCb.current?.(false);
    if (typeof window === "undefined") return;
    let seed = "";
    try {
      seed = window.localStorage.getItem("cp_dev_seed") ?? "";
      if (!seed) {
        seed = crypto.randomUUID();
        window.localStorage.setItem("cp_dev_seed", seed);
      }
    } catch {
      seed = crypto.randomUUID();
    }
    const payload = JSON.stringify({
      v: 1,
      seed,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lang: navigator.language,
      platform: navigator.userAgent.slice(0, 256),
    });
    if (payload.length > MAX_DEVICE_PAYLOAD_BYTES) {
      readyCb.current?.(false);
      return;
    }
    setJson(payload);
    readyCb.current?.(true);
  }, []);

  if (!json) {
    return null;
  }

  return <input type="hidden" name="device_payload" value={json} readOnly />;
}
