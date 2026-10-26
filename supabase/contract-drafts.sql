-- Reviewed setup SQL for the separate BIOracle account project.
-- Apply to the selected project after inspecting its schema; contains no credentials.
begin;

create table public.bioracle_contract_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint draft_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint draft_answers_size check (octet_length(answers::text) <= 150000)
);
alter table public.bioracle_contract_drafts enable row level security;
alter table public.bioracle_contract_drafts force row level security;
revoke all on public.bioracle_contract_drafts from public, anon;
grant select, insert, update on public.bioracle_contract_drafts to authenticated;

create policy "Read own contract draft" on public.bioracle_contract_drafts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own contract draft" on public.bioracle_contract_drafts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own contract draft" on public.bioracle_contract_drafts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Security invoker retains all table RLS restrictions. The explicit user ID
-- also rejects a late request whose browser session changed to another account.
create function public.save_bioracle_contract_draft(
  p_user_id uuid, p_answers jsonb, p_expected_revision bigint
) returns setof public.bioracle_contract_drafts
language plpgsql security invoker set search_path = '' as $$
declare
  saved public.bioracle_contract_drafts;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Account changed; sign in again' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid draft revision' using errcode = '22023';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
      or octet_length(p_answers::text) > 150000 then
    raise exception 'Invalid draft answers' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(p_answers) as entry
    where entry.key <> all(array['agreementType', 'reference', 'projectTitle', 'effectiveDate', 'startDate', 'endDate', 'awardId', 'awardTerms', 'providerName', 'sponsorName', 'providerAddress', 'sponsorAddress', 'providerSigner', 'sponsorSigner', 'providerTitle', 'sponsorTitle', 'providerEmail', 'sponsorEmail', 'projectLead', 'scope', 'deliverables', 'milestones', 'acceptance', 'clientInputs', 'currency', 'totalBudget', 'studentBudget', 'researchBudget', 'directBudget', 'adminBudget', 'taxTerms', 'paymentSchedule', 'invoiceDays', 'budgetApprover', 'approvalDays', 'disbursementDays', 'academicSupervisor', 'studentPlan', 'governingLaw', 'disputeForum', 'ipModel', 'ipDetails', 'publicationTerms', 'confidentialityYears', 'dataTerms', 'terminationDays', 'cureDays', 'liabilityCap', 'specialTerms']::text[])
       or jsonb_typeof(entry.value) <> 'string'
       or length(entry.value #>> '{}') > 6000
  ) then
    raise exception 'Unexpected draft field or value' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.bioracle_contract_drafts(user_id, answers)
    values (p_user_id, p_answers)
    on conflict (user_id) do nothing
    returning * into saved;
  else
    update public.bioracle_contract_drafts
    set answers = p_answers, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = p_user_id and revision = p_expected_revision
    returning * into saved;
  end if;
  if saved.user_id is null then
    raise exception 'Draft changed in another session' using errcode = '40001';
  end if;
  return next saved;
end;
$$;
revoke all on function public.save_bioracle_contract_draft(uuid, jsonb, bigint) from public, anon;
grant execute on function public.save_bioracle_contract_draft(uuid, jsonb, bigint) to authenticated;
commit;
