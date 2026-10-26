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

create table if not exists public.trip_recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists public.trip_recommendation_votes (
  recommendation_id uuid not null references public.trip_recommendations(id) on delete cascade,
  voter_id uuid not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (recommendation_id, voter_id)
);

create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_settings enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_recommendations enable row level security;
alter table public.trip_recommendation_votes enable row level security;
alter table public.trip_notes enable row level security;

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
grant select, insert, delete on public.trip_recommendations to anon;
grant select, insert, update on public.trip_recommendation_votes to anon;
grant select, insert, update, delete on public.trip_notes to anon;

drop policy if exists "Anyone can read trip recommendations" on public.trip_recommendations;
create policy "Anyone can read trip recommendations"
  on public.trip_recommendations for select
  to anon
  using (true);

drop policy if exists "Anyone can add trip recommendations" on public.trip_recommendations;
create policy "Anyone can add trip recommendations"
  on public.trip_recommendations for insert
  to anon
  with check (true);

drop policy if exists "Anyone can remove trip recommendations" on public.trip_recommendations;
create policy "Anyone can remove trip recommendations"
  on public.trip_recommendations for delete
  to anon
  using (true);

drop policy if exists "Anyone can read recommendation votes" on public.trip_recommendation_votes;
create policy "Anyone can read recommendation votes"
  on public.trip_recommendation_votes for select
  to anon
  using (true);

drop policy if exists "Anyone can vote on recommendations" on public.trip_recommendation_votes;
create policy "Anyone can vote on recommendations"
  on public.trip_recommendation_votes for insert
  to anon
  with check (true);

drop policy if exists "Anyone can change recommendation votes" on public.trip_recommendation_votes;
create policy "Anyone can change recommendation votes"
  on public.trip_recommendation_votes for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Anyone can read trip notes" on public.trip_notes;
create policy "Anyone can read trip notes"
  on public.trip_notes for select
  to anon
  using (true);

drop policy if exists "Anyone can add trip notes" on public.trip_notes;
create policy "Anyone can add trip notes"
  on public.trip_notes for insert
  to anon
  with check (true);

drop policy if exists "Anyone can edit trip notes" on public.trip_notes;
create policy "Anyone can edit trip notes"
  on public.trip_notes for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Anyone can delete trip notes" on public.trip_notes;
create policy "Anyone can delete trip notes"
  on public.trip_notes for delete
  to anon
  using (true);

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

do $$
begin
  alter publication supabase_realtime add table public.trip_recommendations;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.trip_recommendation_votes;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.trip_notes;
exception
  when duplicate_object then null;
end
$$;
