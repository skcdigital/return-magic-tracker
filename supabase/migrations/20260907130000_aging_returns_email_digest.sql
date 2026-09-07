-- Daily email digest of return_entries open more than 7 days, sent via
-- Resend. The Resend API key is stored in Supabase Vault under the name
-- 'returns_tracker_resend_api_key' (set separately, never in migration
-- source). Runs via pg_cron + pg_net so no Edge Function secret is needed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public._html_escape(t text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

create or replace function public.send_aging_returns_digest()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resend_key text;
  aging_count int;
  html_rows text;
  html_body text;
begin
  select decrypted_secret into resend_key
  from vault.decrypted_secrets
  where name = 'returns_tracker_resend_api_key'
  limit 1;

  if resend_key is null then
    raise warning 'returns_tracker_resend_api_key not found in vault; skipping digest';
    return;
  end if;

  select count(*), coalesce(string_agg(
    format(
      '<tr><td style="padding:6px 10px;border-bottom:1px solid #2a343c;">%s</td>' ||
      '<td style="padding:6px 10px;border-bottom:1px solid #2a343c;font-family:monospace;">%s</td>' ||
      '<td style="padding:6px 10px;border-bottom:1px solid #2a343c;">%s</td>' ||
      '<td style="padding:6px 10px;border-bottom:1px solid #2a343c;">%s</td>' ||
      '<td style="padding:6px 10px;border-bottom:1px solid #2a343c;text-align:right;">%s days</td></tr>',
      public._html_escape(ref_type),
      public._html_escape(ref_number),
      public._html_escape(coalesce(store_name, '—')),
      public._html_escape(status),
      (current_date - date::date)::text
    ), ''
  ), '')
  into aging_count, html_rows
  from public.return_entries
  where status not in ('completed', 'credit_processed')
    and date ~ '^\d{4}-\d{2}-\d{2}$'
    and (current_date - date::date) > 7;

  if aging_count = 0 then
    return;
  end if;

  html_body := format(
    '<div style="font-family:sans-serif;background:#1a2228;color:#e2e8f0;padding:24px;">' ||
    '<h2 style="color:#fff;margin:0 0 4px;">Returns Tracker — Aging Alert</h2>' ||
    '<p style="color:#94a3b8;margin:0 0 16px;">%s return%s open more than 7 days.</p>' ||
    '<table style="width:100%%;border-collapse:collapse;background:#20282f;border-radius:8px;overflow:hidden;">' ||
    '<thead><tr style="background:#1c242a;color:#94a3b8;font-size:12px;text-transform:uppercase;">' ||
    '<th style="padding:8px 10px;text-align:left;">Type</th><th style="padding:8px 10px;text-align:left;">Reference</th>' ||
    '<th style="padding:8px 10px;text-align:left;">Store</th><th style="padding:8px 10px;text-align:left;">Status</th>' ||
    '<th style="padding:8px 10px;text-align:right;">Aging</th></tr></thead><tbody>%s</tbody></table>' ||
    '<p style="color:#64748b;font-size:12px;margin-top:16px;">Automated daily digest from the Returns Tracker.</p></div>',
    aging_count, case when aging_count = 1 then '' else 's' end, html_rows
  );

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Returns Tracker <alerts@skcdigital.co.za>',
      'to', array['info@skcdigital.co.za'],
      'subject', format('%s return%s aging past 7 days', aging_count, case when aging_count = 1 then '' else 's' end),
      'html', html_body
    )
  );
end;
$$;

select cron.schedule(
  'aging-returns-digest',
  '30 5 * * *',
  $$select public.send_aging_returns_digest();$$
);
