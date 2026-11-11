# Speech speed

In **Settings → Teacher’s voice**, choose a starting speed from **0.5× to 1.5×**
(normal is **1×**). The browser remembers this for new calls. During a call, the
speed button beside the teacher opens the same controls. Dragging the slider
commits on release; the arrow keys and three presets work too.

Ask “slower”, “faster”, “normal speed”, or the equivalent in your language.
The teacher can call `set_speech_speed`. With **Let your teacher adjust** enabled
(the default), it may also adapt gently for comprehension and practice. Turning
it off prevents autonomous changes, while explicit spoken requests still work.
Automatic teacher changes stay within the current call; confirmed student choices
are remembered in this browser. These are device preferences, not account-wide settings.

## Runtime behavior

- Applies to OpenAI Realtime. An xAI call shows that this control is unavailable;
  it never pretends to have changed unsupported provider audio.
- Initial preferences and the student's participant identity travel in signed
  dispatch metadata. The RPC checks the caller against that identity, including guests.
- A small controller shares state between RPC and the teacher tool. During a
  response, updates wait for `response.done`. The OpenAI plugin's public raw-event
  hooks send `session.update` before the next reply. Already-generated/buffered audio
  keeps its existing speed; changing a WebRTC audio element's `playbackRate` is not used.
- The visible active speed changes after OpenAI's `session.updated` acknowledgement.
  Consecutive requests coalesce, provider rejection/ack timeout reports an error,
  and reconnect re-applies the latest choice. Participant attributes carry versioned
  state so a late RPC response cannot undo a newer provider acknowledgement.
- The LiveKit 1.3 adapter retains the confirmed speed in its options snapshot for
  WebSocket reconnection. No dependency or model upgrade is required.
- Pace instructions remain alongside course and coach instructions, preserving
  natural phrasing, pauses, warmth and learning objectives. The parameter controls
  audio speed; it does not by itself create more natural prosody.

## Validation

Offline tests cover turn boundaries, provider acknowledgement/rejection, rapid
changes, timeout, reconnect, auto-off, spoken requests, caller isolation, invalid
payloads, preference storage and state ordering. An adapter test inspects the actual
LiveKit plugin's outbound session update without network access.

An optional wire smoke test opens OpenAI Realtime without a microphone, student
data or audio generation, then verifies initial and changed speed acknowledgements:

```sh
cd apps/agent
uv run pytest tests/test_speech_speed.py -m live -q
```

It uses the configured `OPENAI_API_KEY` and skips when no local key is available.

## References

- [OpenAI Realtime client events](https://developers.openai.com/api/reference/resources/realtime/client-events): session audio output configuration.
- [OpenAI voice prompting](https://developers.openai.com/api/docs/guides/voice-prompting?voice-api=realtime): speed versus phrasing and cadence.
- [LiveKit OpenAI Realtime](https://docs.livekit.io/agents/models/realtime/openai/): speed changes between model turns.
