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
  `student_phones` is written only by the server, never by the browser.
  Calls and texts from an unlinked number are guests: a call is a normal
  guest conversation with no memory; a text gets one reply asking them to
  link the number.
- **Calls.** A LiveKit SIP dispatch rule sends each call to the `speakwow`
  agent with metadata `{"channel": "phone"}`. The agent reads the caller's
  number (`sip.phoneNumber`), finds the student, loads their memory and the
  latest texts, and talks with the teacher they spoke to last. There is no
  screen on a phone, so there are no cards or stickers. Sessions are stored
  with `channel = 'phone'` and reflected on after the call, like web calls.
- **Texts.** Twilio posts each text to `sms_server.py`, which checks
  Twilio's signature, answers as the same teacher with a text model, and
  replies in the same HTTP response. Texts are stored as one session per
  student per day (`channel = 'sms'`). STOP turns texting off for that
  number, START turns it back on; a student can send at most
  `SMS_DAILY_LIMIT` (60) texts a day.
- **A different model for texts.** `SMS_MODEL` picks it (default
  `deepseek/deepseek-v4.1-flash` through the Vercel AI Gateway), or point
  `SMS_LLM_API_KEY` / `SMS_LLM_BASE_URL` at any OpenAI-compatible endpoint.

## Setting it up

You need a Twilio account and a LiveKit Cloud project. Use one Twilio number
for both calls and texts.

1. **Database.** Apply `supabase/migrations/0004_phone_and_sms.sql`
   (`supabase db push`).
2. **A number.** In Twilio, buy a number with Voice and SMS. In the US,
   texting from a local number needs **A2P 10DLC registration** (brand and
   campaign), which takes days to weeks; a toll-free number needs
   toll-free verification instead. Until it is approved, carriers block
   your texts.
3. **Codes.** Create a Twilio Verify service. Put `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `SPEAKWOW_PHONE_NUMBER`
   and `SUPABASE_SERVICE_ROLE_KEY` on the web app. The Phone section in
   Settings appears once they are set.
4. **Calls.** Follow LiveKit's
   [Twilio inbound guide](https://docs.livekit.io/telephony/accepting-calls/):
   create an inbound trunk for your number, then a dispatch rule that puts
   each caller in their own room and dispatches the agent:

   ```json
   {
     "rule": { "dispatchRuleIndividual": { "roomPrefix": "call-" } },
     "roomConfig": {
       "agents": [{ "agentName": "speakwow", "metadata": "{\"channel\": \"phone\"}" }]
     }
   }
   ```

   Add `"persona": "lily"` to the metadata to give a number its own teacher.
5. **Texts.** Run a second service from the agent image with the start
   command `uv run src/sms_server.py` and give it a public URL. Set
   `TWILIO_AUTH_TOKEN`, `SMS_WEBHOOK_URL` (that exact URL plus
   `/twilio/sms`), the Supabase variables and `AI_GATEWAY_API_KEY` (or
   `SMS_LLM_*`). In Twilio, set the number's "A message comes in" webhook
   to `SMS_WEBHOOK_URL`, method POST.
6. **Try it.** Link your number in Settings, text the teacher, then call.
   On the call, mention what you texted: the teacher should know.

## Limits

- **Mainland China.** A Chinese number needs a licensed carrier partner, and
  calls and texts from overseas numbers to Chinese phones are often blocked.
  Students in China should use the website or the app.
- **Caller ID can be faked** on the phone network. Only a linked number gets
  memory, and what a teacher remembers is light by design, but a call is not
  proof of identity. Twilio's STIR/SHAKEN result (`StirVerstat`) is a
  possible next step for US numbers.
- **The teacher never texts first.** It only answers. Reminders and "how did
  the exam go?" messages are a later feature, and must be opt-in.
