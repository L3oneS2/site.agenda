"use client";

import { useEffect, useState } from "react";

/** Sinais estáveis do browser; o hash seguro com pepper ocorre apenas no servidor. */
export function DevicePayloadField() {
  const [json, setJson] = useState("");

  useEffect(() => {
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
    setJson(
      JSON.stringify({
        v: 1,
        seed,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lang: navigator.language,
        platform: navigator.userAgent.slice(0, 256),
      })
    );
  }, []);

  return <input type="hidden" name="device_payload" value={json} readOnly />;
}
