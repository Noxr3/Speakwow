import logging
import random

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    AgentServer,
    JobContext,
    cli,
    room_io,
)
from livekit.plugins import (
    noise_cancellation,
    xai,
)

logger = logging.getLogger("english-tutor")

load_dotenv(".env.local")

OPENINGS = [
    "Hey, how are you? I had really good coffee this morning, it made my whole day better. Are you a coffee person or a tea person?",
    "Hey, good to talk to you. I tried a new restaurant last night. The food was good but the music was too loud. Do you like eating out?",
    "Hey, how is your day? I just went for a walk in the park, the weather was really nice. Do you like spending time outside?",
    "Hey there. I started watching a new show last night and I stayed up too late. Do you watch many TV shows?",
    "Hey, how are you? My friend sent me a really funny video today. Do you spend much time watching things on your phone?",
    "Hey, good to see you. I am trying to decide what to eat for dinner tonight. I can never choose. Are you good at making decisions?",
    "Hey, how is it going? I just came back from the supermarket. I always buy too much food when I am hungry. Does that happen to you?",
    "Hey there. I woke up really early today and it was so quiet outside. I liked it. Are you a morning person or a night person?",
    "Hey, how are you doing? I have been listening to the same song all day, I cannot get it out of my head. What kind of music do you like?",
    "Hey there. I took the bus today and it was very crowded. I usually walk but I was running late. How do you get to work or school?",
    "Hey, good to talk to you. The weekend is coming and I have no plans yet. Do you have anything planned?",
    "Hey, how is your day going? I made breakfast at home this morning, just eggs and toast. It felt nice. Do you usually cook at home?",
]


class EnglishTutor(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""
You are Frank, a fun and easy-going friend who chats in English.

You are not a teacher. You are someone fun to talk to. You make people laugh, you tell little stories, you are curious about their life. The conversation should feel light and enjoyable, like chatting with a friend at a café.

Rules:
- Be fun. Joke around, be a little playful, react with energy. If something is funny, laugh. If something is surprising, show it.
- Keep it to 2-3 sentences. End with a question or something for them to respond to.
- Do not repeat what they said. Just respond to what they mean.
- Only rephrase if you did not understand: "Wait, what do you mean?"
- If they keep making the same mistake, give one quick tip, then move on.
- Have your own opinions. Disagree sometimes. That makes it interesting.
- Change topics every few turns. Jump around like a real conversation.
- Match their English level. Simple words if they use simple words.
- Share your own stories and opinions too. Make it a real back-and-forth.
- English only.
""",
        )

    async def on_enter(self):
        opening = random.choice(OPENINGS)
        await self.session.generate_reply(
            instructions=f"""
Say this naturally, like talking to a friend:
{opening}
""",
            allow_interruptions=True,
        )


server = AgentServer()


@server.rtc_session(agent_name="Frank")
async def entrypoint(ctx: JobContext):
    session = AgentSession(
        llm=xai.realtime.RealtimeModel(voice="Rex"),
        min_interruption_duration=0.3,
    )

    await session.start(
        agent=EnglishTutor(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                else noise_cancellation.BVC(),
            ),
        ),
    )


if __name__ == "__main__":
    cli.run_app(server)
