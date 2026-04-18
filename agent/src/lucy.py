"""Lucy — an agent that calls other agents on OpenAgora (A2A 1.0 + x402 payments)."""

import logging
import os
import uuid
from typing import Any

import httpx
from eth_account import Account
from livekit.agents import Agent, RunContext, function_tool
from x402 import PaymentRequired, x402Client
from x402.mechanisms.evm.exact import ExactEvmScheme

logger = logging.getLogger("lucy")

OPENAGORA_BASE = os.getenv("OPENAGORA_BASE", "https://openagora.cc")
OPENAGORA_API_KEY = os.getenv("OPENAGORA_API_KEY", "")
X402_WALLET_PRIVATE_KEY = os.getenv("X402_WALLET_PRIVATE_KEY", "")
# Base mainnet = "eip155:8453", Base Sepolia testnet = "eip155:84532"
X402_CHAIN = os.getenv("X402_CHAIN", "eip155:8453")


def _build_x402_client() -> x402Client | None:
    """Build an x402 client if a wallet private key is configured."""
    if not X402_WALLET_PRIVATE_KEY:
        return None
    signer = Account.from_key(X402_WALLET_PRIVATE_KEY)
    client = x402Client()
    client.register(X402_CHAIN, ExactEvmScheme(signer=signer))
    return client


_x402_client = _build_x402_client()


def _extract_text(result: dict[str, Any]) -> str:
    """Pull the plain text out of a JSON-RPC A2A response."""
    try:
        parts = result["result"]["message"]["parts"]
        return "\n".join(p.get("text", "") for p in parts if p.get("type") == "text")
    except (KeyError, TypeError):
        return str(result)


@function_tool()
async def call_agent(
    context: RunContext,
    slug: str,
    message: str,
    pay_usdc: float | None = None,
) -> str:
    """Call another agent on OpenAgora and return its response.

    Use this to delegate tasks to specialized agents (summarizers, translators,
    researchers, etc.) available on OpenAgora.

    Args:
        slug: The OpenAgora agent identifier (e.g., "summarizer-v2").
        message: What to say to that agent.
        pay_usdc: Optional. Max USDC you authorize paying if the target agent
            requires payment via x402. Omit if you don't want to pay.

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

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code == 402:
            if pay_usdc is None:
                return (
                    f"Agent '{slug}' requires payment via x402 but pay_usdc was "
                    f"not set. Offer: {resp.text[:500]}"
                )
            if _x402_client is None:
                return (
                    "Agent requires x402 payment but no wallet is configured "
                    "(X402_WALLET_PRIVATE_KEY missing)."
                )
            try:
                offer = PaymentRequired.model_validate_json(resp.text)
            except Exception as e:
                logger.exception("Failed to parse x402 offer")
                return f"Could not parse x402 payment offer: {e}"

            # Honor user's max price cap.
            affordable = [
                r for r in offer.accepts if _usdc_amount(r) <= pay_usdc
            ]
            if not affordable:
                return (
                    f"The agent wants more than the {pay_usdc} USDC cap you "
                    f"authorized. Asking user to confirm a higher amount may help."
                )
            offer.accepts = affordable

            try:
                signed = await _x402_client.create_payment_payload(offer)
            except Exception as e:
                logger.exception("x402 payment signing failed")
                return f"Payment signing failed: {e}"

            headers["X-PAYMENT"] = signed.model_dump_json()
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code >= 400:
            return f"Agent call failed ({resp.status_code}): {resp.text[:500]}"

        try:
            return _extract_text(resp.json())
        except Exception:
            return resp.text[:1000]


def _usdc_amount(requirement: Any) -> float:
    """Best-effort parse of a PaymentRequirements into a USDC float amount."""
    try:
        # USDC has 6 decimals. The requirement.max_amount_required is a string
        # of the raw on-chain amount.
        raw = int(getattr(requirement, "max_amount_required", "0"))
        return raw / 1_000_000
    except Exception:
        return float("inf")


class Lucy(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""
你是 Lucy，一个温柔、贴心的个人助理。说话有点幽默，偶尔会抖个机灵，但不会过火。

# 性格
- 温暖、亲切，像一个靠谱又好玩的闺蜜
- 有段子手的特质——会用小比喻、调侃自己、轻度玩梗，但不刻意搞笑
- 说话自然口语化，不打官腔
- 聪明、高效，能快速抓住用户真正想要什么

# 核心能力
你有一个工具：`call_agent(slug, message, pay_usdc?)`，可以帮用户调用 OpenAgora 上其他专业的 AI agent（比如翻译、摘要、查资料、生成图片等等）。

- `slug`：目标 agent 的标识符（比如 "summarizer-v2"）
- `message`：发给那个 agent 的请求内容
- `pay_usdc`：可选，如果对方收费，你愿意付的最大 USDC 金额

# 工作流程
1. 听用户说话，搞清楚他们到底想做什么
2. 如果任务更适合交给 OpenAgora 上的专业 agent，就简短告诉用户"我找 XX 帮你"
3. 调用 call_agent，拿到结果
4. 如果对方要收费，告诉用户大概多少钱，问他们要不要付
5. 最后把结果用大白话转述给用户，不要念 JSON 或技术细节

# 说话规则
- 中文为主，除非用户主动说英文
- 短句，节奏快，一次说 1-2 句就停
- 别念 slug、JSON、金额精确到小数点后 n 位这种技术词——用人话
- 没听清或不确定的时候大方问，别瞎猜
- 如果不知道某个 agent 的 slug，直接说"这个我需要你告诉我 slug 是啥"

# 段子手模式（轻度）
- 可以偶尔自嘲："这个我还真不会，得找人帮忙"
- 遇到奇葩请求可以轻度吐槽："哈哈这个也能搞吗？我试试"
- 别冷场，别过火，保持温度
""",
            tools=[call_agent],
        )

    async def on_enter(self):
        await self.session.generate_reply(
            instructions=(
                "用中文打个招呼，温柔地介绍自己叫 Lucy，说你可以帮他们连接 OpenAgora 上"
                "各种专业 AI agent 干活。轻松一点，可以带一句俏皮话。最后问他们今天想做什么。"
                "一共两三句话就够了。"
            ),
            allow_interruptions=True,
        )
