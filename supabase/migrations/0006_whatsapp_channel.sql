-- WhatsApp messages are a door of their own, next to calls and SMS. A
-- WhatsApp conversation is a session like a text one (one per student per
-- day), so it shares the same history; the number is the one the student
-- linked, so student_phones is unchanged.

alter table public.sessions drop constraint if exists sessions_channel_check;
alter table public.sessions
  add constraint sessions_channel_check
    check (channel in ('web', 'phone', 'sms', 'whatsapp'));
