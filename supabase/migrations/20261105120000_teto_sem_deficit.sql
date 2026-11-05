-- Teto de kcal do dia = basal + rotina + exercício: sem déficit fixo e sem ajuste de 7 dias (docs/calorias.md).
-- v_energy_daily.target_balance_kcal = −deficit_kcal passa a 0, então app e `fit kcal-day` mostram a mesma meta.
-- A coluna fica: o déficit volta a valer só mudando este número. Em banco novo a linha vem do seed (também 0).
update public.goals
   set deficit_kcal = 0,
       note = 'Teto do dia = basal + rotina + exercício, sem déficit fixo. Regra em docs/calorias.md.'
 where deficit_kcal <> 0;
