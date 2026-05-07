export type ProfileRole = "barber" | "client";

export type SubscriptionStatus = "trial" | "active" | "expired" | "canceled";

export type AppointmentStatus = "scheduled" | "canceled";

export interface Profile {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
}

export interface Barbershop {
  id: string;
  user_id: string;
  nome_barbearia: string;
  endereco: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  account_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  user_id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
  created_at: string;
  updated_at: string;
}

export interface Availability {
  id: string;
  user_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  barber_id: string;
  servico_id: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
  services?: Pick<Service, "id" | "nome" | "preco" | "duracao_minutos"> | null;
}
