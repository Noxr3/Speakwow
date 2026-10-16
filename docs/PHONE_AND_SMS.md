# Phone calls and text messages

A student links their phone on the website (Settings → Phone). From then on
they can **call** the teacher's number and talk exactly as in the app, and
**text** it between lessons. It is the same teacher and the same memory:
a call knows what you texted this week, a text knows your last call.

```
             ┌─────────── call ──────────┐
 student ────┤                            ├──► LiveKit SIP ──► agent (voice, grok-voice-3.0)
 phone       └─────────── text ──────────┐                              │
                                          └──► sms_server (text model) ─┤
                                                                         ▼
                                              Supabase: student_phones, sessions(channel), messages
```

## How it works

- **Who is calling.** A number counts as a student only after they linked it
  on the website and typed the code we texted to it (Twilio Verify).
  `student_phones` is written only by the server, never by the browser. A
  code proves the phone is in their hands, so if a number changes owner, the
  link moves to whoever verified it last. Asking for a code never reveals
  whether a number belongs to someone else, and codes are limited to 5 an
  hour per account and 20 a day per address (Vercel KV), on top of Twilio's
  own per-number limit.
- **Calls.** A LiveKit SIP dispatch rule sends each call to the `speakwow`
  agent with metadata `{"channel": "phone"}`. Caller ID is easy to fake, so
  the agent recognises a student only when the carrier verified the
  caller's number: Twilio's STIR/SHAKEN result `X-Twilio-VerStat` must be
  `TN-Validation-Passed-A`. Then it loads their memory and the latest
  texts and talks with the teacher they spoke to last. Any other caller,
  including a linked number the carrier did not verify, is a guest with no
  memory. `ALLOW_GUESTS=false` hangs up on guests and `REQUIRE_BYOK=true`
  closes the line (a student's own model key lives in their browser). A call
  ends after `PHONE_MAX_MINUTES` (40) with a goodbye. There is no screen on a
  phone, so there are no cards or stickers. Sessions are stored with
  `channel = 'phone'` and reflected on after the call, like web calls.
- **Texts and WhatsApp.** Twilio posts each SMS or WhatsApp message to
  `sms_server.py`, which checks Twilio's signature and answers Twilio at
  once. The reply is written by a text model as the same teacher and sent
  back through Twilio's Messages API the way the message came (SMS to SMS,
  WhatsApp to WhatsApp). The exchange is stored only once the reply went
  out, as one session per student, channel and day (`channel = 'sms'` or
  `'whatsapp'`). An SMS reply stays within two segments (134 characters
  once it holds any Chinese or emoji). STOP turns texting off for that
  number, START turns it back on; a student can send at most
  `SMS_DAILY_LIMIT` (60) messages a day per channel. An unlinked number is
  told to link it once a day, and a picture or voice note gets a friendly
  "type it or call me".
- **A different model for texts.** `SMS_MODEL` picks it (default
  `deepseek/deepseek-v4.1-flash` through the Vercel AI Gateway), or point
  `SMS_LLM_API_KEY` / `SMS_LLM_BASE_URL` at any OpenAI-compatible endpoint.

## Setting it up

You need a Twilio account and a LiveKit Cloud project. Use one Twilio number
for calls and texts; WhatsApp gets a sender of its own.

1. **Database.** Apply the migrations up to `0009_whatsapp_channel.sql`
   (`supabase db push`).
2. **A number.** In Twilio, buy a number with Voice and SMS. In the US,
   texting from a local number needs **A2P 10DLC registration** (brand and
   campaign), which takes days to weeks; a toll-free number needs
   toll-free verification instead. Until it is approved, carriers block
   your texts.
3. **Codes.** Create a Twilio Verify service (turn on Fraud Guard, and allow
   only the countries you serve). Put `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `SPEAKWOW_PHONE_NUMBER`
   and `SUPABASE_SERVICE_ROLE_KEY` on the web app. The Phone section in
   Settings appears once they are set.
4. **Calls.** Follow LiveKit's
   [Twilio inbound guide](https://docs.livekit.io/telephony/accepting-calls/):
   create an inbound trunk for your number, and have it pass the caller-ID
   check on to the agent with `"headers_to_attributes": {"X-Twilio-VerStat":
   "twilio.verstat"}` (without it every caller is a guest). Then a dispatch
   rule that puts each caller in their own room and dispatches the agent:

   ```json
   {
     "rule": { "dispatchRuleIndividual": { "roomPrefix": "call-" } },
     "roomConfig": {
       "agents": [{ "agentName": "speakwow", "metadata": "{\"channel\": \"phone\"}" }]
     }
   }
   ```

   Add `"persona": "lily"` to the metadata to give a number its own teacher.
   Outside the US and Canada carriers do not verify caller IDs, so every
   caller would be a guest; `PHONE_TRUST_UNVERIFIED=on` on the agent trusts
   a linked number anyway, knowing a faked caller ID then gets that
   student's memory.
5. **Texts.** Run a second service from the agent image with the start
   command `uv run src/sms_server.py` and give it a public URL. Set
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `SMS_WEBHOOK_URL` (that exact
   URL plus `/twilio/sms`), the Supabase variables and `AI_GATEWAY_API_KEY`
   (or `SMS_LLM_*`). In Twilio, set the number's "A message comes in"
   webhook to `SMS_WEBHOOK_URL`, method POST.
6. **WhatsApp.** To try it, use the Twilio WhatsApp Sandbox: join it from
   your phone with its code and set its "When a message comes in" URL to
   the same `SMS_WEBHOOK_URL`. For real students, register a WhatsApp
   sender (Twilio console, Messaging → Senders → WhatsApp senders), which
   needs a Meta Business account and Meta's approval of the display name,
   and point its webhook at the same URL. The teacher only answers, so every
   reply falls inside WhatsApp's 24-hour window and needs no templates.
7. **Try it.** Link your number in Settings, text the teacher (SMS or
   WhatsApp), then call. On the call, mention what you texted: the teacher
   should know.

## Limits

- **Mainland China.** A Chinese number needs a licensed carrier partner;
  calls and texts from overseas numbers to Chinese phones are often blocked,
  and WhatsApp is not reachable there. Students in China should use the
  website or the app.
- **Caller ID.** Only a carrier-verified caller gets their memory (see
  Calls), because on a call whoever faked the number hears the answer.
  Texts are different: a reply always goes to the real number, so a faked
  sender never reads it; at worst it adds a line to the student's text
  history. WhatsApp senders cannot be faked.
- **The teacher never texts first.** It only answers. Reminders and "how did
  the exam go?" messages are a later feature, must be opt-in, and on
  WhatsApp need approved templates.
