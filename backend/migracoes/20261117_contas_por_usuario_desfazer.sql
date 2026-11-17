-- Desfaz 20261117_contas_por_usuario.sql. Só funciona se os nomes não se repetirem entre contas,
-- porque volta o nome único no sistema todo. Apaga as contas e as sessões.
begin;

alter table attributes drop constraint if exists uq_attributes_user_name;
alter table materials drop constraint if exists uq_materials_user_name;
alter table formulas drop constraint if exists uq_formulas_user_name;
alter table attributes add constraint attributes_name_key unique (name);
alter table materials add constraint materials_name_key unique (name);
alter table formulas add constraint formulas_name_key unique (name);

alter table attributes drop column if exists user_id;
alter table materials drop column if exists user_id;
alter table formulas drop column if exists user_id;

drop table if exists auth_attempts;
drop table if exists sessions;
drop table if exists users;

commit;
