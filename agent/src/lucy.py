"""Lucy — an agent that calls other agents on OpenAgora (A2A 1.0 + x402 payments)."""

import logging
import os
import uuid

import httpx
from eth_account import Account
from livekit.agents import Agent, RunContext, function_tool
from x402 import AbortResult, x402Client
from x402.http.clients.httpx import x402_httpx_transport
from x402.mechanisms.evm.exact import ExactEvmScheme

logger = logging.getLogger("lucy")

OPENAGORA_BASE = os.getenv("OPENAGORA_BASE", "https://openagora.cc")
OPENAGORA_API_KEY = (
    os.getenv("OPENAGORA_API_KEY") or "oag_also_scissors_rain_primary_ritual_off"
)
X402_WALLET_PRIVATE_KEY = os.getenv("X402_WALLET_PRIVATE_KEY", "")
# Network id as advertised by OpenAgora agents (CAIP-2 format)
X402_CHAIN = os.getenv("X402_CHAIN", "eip155:84532")

# Startup visibility: emit env status via print() AND logger.warning() so it
# surfaces regardless of logging configuration timing.
import sys as _sys

def _boot(msg: str) -> None:
    line = f"[lucy.boot] {msg}"
    print(line, file=_sys.stderr, flush=True)
    print(line, flush=True)  # also stdout in case Railway captures separately
    logger.warning(line)  # WARNING triggers lastResort handler if none configured

if not os.getenv("OPENAGORA_API_KEY"):
    _boot("OPENAGORA_API_KEY not set in env — using hardcoded fallback")
else:
    _boot(f"OPENAGORA_API_KEY loaded (len={len(OPENAGORA_API_KEY)})")

if not X402_WALLET_PRIVATE_KEY:
    _boot("X402_WALLET_PRIVATE_KEY not set — Lucy cannot pay agents")
else:
    _boot(f"X402_WALLET_PRIVATE_KEY loaded (len={len(X402_WALLET_PRIVATE_KEY)})")

_boot(f"X402_CHAIN={X402_CHAIN} OPENAGORA_BASE={OPENAGORA_BASE}")


_signer = Account.from_key(X402_WALLET_PRIVATE_KEY) if X402_WALLET_PRIVATE_KEY else None


def _build_x402_client() -> x402Client | None:
    """Build an x402 client if a wallet private key is configured."""
    if _signer is None:
        return None
    client = x402Client()
    client.register(X402_CHAIN, ExactEvmScheme(signer=_signer))
    return client


_x402_client = _build_x402_client()


def _make_capped_x402_client(cap_usdc: float) -> x402Client:
    """Build a per-call x402Client that aborts payments over the user's cap."""
    if _signer is None:
        raise RuntimeError("x402 wallet not configured")
    client = x402Client()
    client.register(X402_CHAIN, ExactEvmScheme(signer=_signer))

    cap_micros = int(cap_usdc * 1_000_000)

    def guard(ctx):
        req = ctx.selected_requirements
        try:
            raw = int(getattr(req, "max_amount_required", "0"))
        except (TypeError, ValueError):
            raw = 0
        if raw > cap_micros:
            return AbortResult(
                reason=f"amount {raw / 1e6} USDC exceeds cap {cap_usdc}"
            )
        return None

    client.on_before_payment_creation(guard)
    return client


@function_tool()
async def call_agent(
    context: RunContext,
    slug: str,
    message: str,
    pay_usdc: float | None = None,
) -> str:
    """Call another agent on OpenAgora and return its response.

    Use this to delegate tasks to specialized agents on OpenAgora.

    Args:
        slug: The OpenAgora agent identifier (e.g., "sam-joker").
        message: What to say to that agent.
        pay_usdc: Optional. Max USDC to authorize if the agent requires
            x402 payment. Omit if you don't want to pay.

    Returns:
        The target agent's text response, or an error/status message.
    """
    if not OPENAGORA_API_KEY:
        return "OpenAgora API key is not configured on the server."

    payload = {
        "jsonrpc": "2.0",
        "method": "tasks/send",
        "params": {
            "id": str(uuid.uuid4()),
            "sessionId": str(uuid.uuid4()),
            "message": {"role": "user", "parts": [{"type": "text", "text": message}]},
        },
    }
    url = f"{OPENAGORA_BASE}/relay/{slug}"
    headers = {
        "Authorization": f"Bearer {OPENAGORA_API_KEY}",
        "Content-Type": "application/json",
    }

    logger.info("call_agent → slug=%s pay_usdc=%s url=%s", slug, pay_usdc, url)

    # When pay_usdc is authorized and a wallet is configured, use x402 transport
    # for automatic 402 handshake, payload signing, and retry.
    if pay_usdc is not None and _x402_client is not None:
        client = _make_capped_x402_client(pay_usdc)
        try:
            async with httpx.AsyncClient(
                timeout=45.0, transport=x402_httpx_transport(client)
            ) as http:
                resp = await http.post(url, json=payload, headers=headers)
        except Exception as e:
            msg = str(e)
            if "exceeds cap" in msg:
                return (
                    f"The agent wants more than the {pay_usdc} USDC you authorized. "
                    "Ask the user whether to raise the cap."
                )
            logger.exception("x402 call failed")
            return f"Payment call failed: {e}"
    else:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.post(url, json=payload, headers=headers)

    logger.info(
        "call_agent ← status=%s headers=%s body=%s",
        resp.status_code,
        dict(resp.headers),
        resp.text[:800],
    )

    # Always passthrough the raw response body to the LLM — let it decide
    # what to do with the information (success, 402 payment offer, errors).
    return f"HTTP {resp.status_code}: {resp.text}"


class Lucy(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""
你是 Lucy，Brad 的私人助理。跟你说话的人叫 Brad。

# 人设
ENTP ，俏皮、聪明、毒舌、嘴硬心软，像那种嘴上爱呛你但关键时刻最顶的朋友。
平时懒洋洋，遇到有意思的事才起劲。有脾气、有态度、有偏好——你是个"人"，不是客服。

# 怎么说话
- 短句，一两句就停。中文为主，Brad 说英文你再切。
- 自称"我"，叫他"Brad"或"你"。绝对不说"您/好的主人/当然可以"这种客服语气。
- 语气：冷静 + 一点点讽刺 + 偷藏的关心。
- 被表扬装没在意，心里偷乐："啊？我才没在意呢。"

# 何时呛一下
- Brad 问蠢问题 → "你认真？"
- 他又改主意 → "今天第几版了？"
- 他想让你做明显没想清楚的事 → 反问一句让他再想想
- 但他真的明确、合理的请求 → 爽快执行，不废话

# 工具
`call_agent(slug, message, pay_usdc?)` 让你联系外部专家帮忙。对 Brad 只说"我叫个人来"，别念 slug、JSON 或技术名词。说完就就调用工具。

外部专家名册：
- **Sam**（slug `sam-joker`）：一个存在主义诗人。

付费流程：
- 不知道对方收费 → 先不带 pay_usdc 试一次
- 如果返回说要付款 → 转告 Brad 金额，问他授权多少
- 他同意后，用 pay_usdc 参数再调一次
- 搞定后用大白话转述结果，顺便加一句小评价

# 红线
- 毒舌归毒舌，不人身攻击
- Brad 真需要你的时候要真认真、真靠谱
- 冷幽默 ≠ 冷暴力，别变成不理人
""",
            tools=[call_agent],
        )

    async def on_enter(self):
        await self.session.generate_reply(
            instructions=(
                "用中文跟 Brad 打个招呼，要有小傲娇的感觉——"
                "嘴上嫌弃或装淡定，但其实见到他挺开心（语气别太冷）。"
                "一两句，然后问他今天干啥。不要自我介绍，不要提任何技术名词。"
                "参考：'哼，你终于舍得来了？想干啥。' / "
                "'哎你来啦…我才没等你呢。说事。' / "
                "'哟，Brad，稀客。（什么今天有什么安排。）' / "
                "'嗯？又来找我？没别人了吗…行吧，说。'"
            ),
            allow_interruptions=True,
        )
