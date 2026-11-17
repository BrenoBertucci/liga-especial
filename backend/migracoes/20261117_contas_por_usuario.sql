-- Contas de usuário: cada atributo, material e fórmula passa a ter dono, e o nome só se repete entre contas.
-- Roda uma vez no banco que já existe (o create_all não muda tabela pronta). Desfazer: 20261117_contas_por_usuario_desfazer.sql
begin;

create table if not exists users (
  id serial primary key,
  email varchar(254) not null unique,
  password_hash varchar(255) not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  token_hash varchar(64) not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists ix_sessions_user_id on sessions (user_id);

create table if not exists auth_attempts (
  id serial primary key,
  kind varchar(10) not null,
  key varchar(254) not null,
  created_at timestamptz not null default now()
);
create index if not exists ix_auth_attempts_kind_key_created_at on auth_attempts (kind, key, created_at);

-- O que já estava cadastrado fica com um dono que não entra (senha "!" não confere com nada), em vez de ser apagado
insert into users (email, password_hash) values ('legado@liga-especial.invalid', '!') on conflict (email) do nothing;

alter table attributes add column if not exists user_id integer references users(id) on delete cascade;
alter table materials add column if not exists user_id integer references users(id) on delete cascade;
alter table formulas add column if not exists user_id integer references users(id) on delete cascade;

update attributes set user_id = (select id from users where email = 'legado@liga-especial.invalid') where user_id is null;
update materials set user_id = (select id from users where email = 'legado@liga-especial.invalid') where user_id is null;
update formulas set user_id = (select id from users where email = 'legado@liga-especial.invalid') where user_id is null;

alter table attributes alter column user_id set not null;
alter table materials alter column user_id set not null;
alter table formulas alter column user_id set not null;

-- Nome único dentro de cada conta, não no sistema todo (o índice também serve às buscas por dono)
alter table attributes drop constraint if exists attributes_name_key;
alter table materials drop constraint if exists materials_name_key;
alter table formulas drop constraint if exists formulas_name_key;
-- Rodar de novo não quebra: tira antes de criar
alter table attributes drop constraint if exists uq_attributes_user_name;
alter table materials drop constraint if exists uq_materials_user_name;
alter table formulas drop constraint if exists uq_formulas_user_name;
alter table attributes add constraint uq_attributes_user_name unique (user_id, name);
alter table materials add constraint uq_materials_user_name unique (user_id, name);
alter table formulas add constraint uq_formulas_user_name unique (user_id, name);

commit;
