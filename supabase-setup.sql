create table if not exists public.trip_settings (
  id boolean primary key default true check (id = true),
  train_support_amount numeric(12, 2) check (train_support_amount is null or train_support_amount >= 0),
  participant_count integer not null default 9 check (participant_count > 0),
  updated_at timestamptz not null default now()
);

insert into public.trip_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 80),
  payer text not null check (char_length(payer) between 1 and 40),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.trip_settings enable row level security;
alter table public.trip_expenses enable row level security;

grant usage on schema public to anon;

drop policy if exists "Anyone can read trip settings" on public.trip_settings;
create policy "Anyone can read trip settings"
  on public.trip_settings for select
  to anon
  using (true);

drop policy if exists "Anyone can update trip settings" on public.trip_settings;
create policy "Anyone can update trip settings"
  on public.trip_settings for update
  to anon
  using (id = true)
  with check (id = true);

drop policy if exists "Anyone can read trip expenses" on public.trip_expenses;
create policy "Anyone can read trip expenses"
  on public.trip_expenses for select
  to anon
  using (true);

drop policy if exists "Anyone can add trip expenses" on public.trip_expenses;
create policy "Anyone can add trip expenses"
  on public.trip_expenses for insert
  to anon
  with check (true);

drop policy if exists "Anyone can remove trip expenses" on public.trip_expenses;
create policy "Anyone can remove trip expenses"
  on public.trip_expenses for delete
  to anon
  using (true);

grant select, update on public.trip_settings to anon;
grant select, insert, delete on public.trip_expenses to anon;

do $$
begin
  alter publication supabase_realtime add table public.trip_settings;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.trip_expenses;
exception
  when duplicate_object then null;
end
$$;
