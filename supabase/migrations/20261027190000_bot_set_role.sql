-- Permite que o admin (postgres) assuma o role bot via "set local role bot" (acesso do bot por HTTPS/Management API).
-- Não dá privilégios extras ao bot; só deixa o postgres executar como bot (RLS + grants mínimos valem).
grant bot to postgres with set true, inherit false;
