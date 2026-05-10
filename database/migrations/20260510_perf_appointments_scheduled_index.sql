-- Performance: consultas por barbeiro + intervalo de datas com status "scheduled"
-- (calendário público, agenda, middleware/admin paths que filtram scheduled)
CREATE INDEX IF NOT EXISTS idx_appointments_barber_scheduled_data
  ON public.appointments (barber_id, data)
  WHERE status = 'scheduled';
