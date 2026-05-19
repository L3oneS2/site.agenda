"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Barbershop, Service } from "@/lib/types";
import { ServicesGrid } from "./services-grid";
import { BookingWizard } from "./booking-wizard";

type Tab = "servicos" | "agendar";

export function PublicBarbershop({
  barbershop,
  services,
  initialTodayYmd,
}: {
  barbershop: Barbershop;
  services: Service[];
  initialTodayYmd: string;
}) {
  const [tab, setTab] = useState<Tab>("servicos");

  return (
    <div className="mt-10 space-y-8">
      <div
        role="tablist"
        aria-label="Navegação da barbearia"
        className="mx-auto flex max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1"
      >
        {(
          [
            ["servicos", "Serviços"],
            ["agendar", "Agendar"],
          ] as const
        ).map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`relative flex-1 rounded-xl py-3 text-sm font-medium transition-colors ${
                active ? "text-[var(--fg)]" : "text-[var(--muted)]"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="barbearia-tab"
                  className="absolute inset-0 rounded-xl bg-gold-500/15 shadow-gold ring-1 ring-gold-500/25"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              ) : null}
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {tab === "servicos" ? (
          <ServicesGrid services={services} onBook={() => setTab("agendar")} />
        ) : (
          <BookingWizard
            barbershopId={barbershop.id}
            services={services}
            initialTodayYmd={initialTodayYmd}
          />
        )}
      </motion.div>
    </div>
  );
}
