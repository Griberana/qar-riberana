-- Ejecutar completo en Supabase → SQL Editor → New query → Run
create table if not exists users (
  email text primary key,
  nombre text not null,
  pin_hash text not null,
  rol text not null default 'supervisor',          -- 'admin' | 'supervisor'
  propiedades text[] not null default '{}',        -- {'MX051','MX056','MX061'} o {'ALL'}
  tipos text[] not null default '{qar,diaria}',    -- 'qar' = Inspección QAR, 'diaria' = Guardia Diaria
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists inspections (
  id text primary key,
  propiedad text not null,
  tipo text not null check (tipo in ('qar','diaria')),
  estado text not null default 'borrador' check (estado in ('borrador','cerrada','publicada')),
  fecha date not null,
  supervisor text,
  user_email text,
  score numeric,
  data jsonb not null default '{}',
  bc_card_id bigint,
  bc_url text,
  bc_steps_done int not null default 0,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  published_at timestamptz
);
create index if not exists inspections_lookup on inspections (tipo, propiedad, fecha desc);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text, action text, inspection_id text, detail text
);

-- Bucket público para fotos de hallazgos
insert into storage.buckets (id, name, public) values ('qar-fotos','qar-fotos', true)
on conflict (id) do nothing;

-- Seguridad: solo el servidor (service_role) toca las tablas
alter table users enable row level security;
alter table inspections enable row level security;
alter table audit_log enable row level security;
