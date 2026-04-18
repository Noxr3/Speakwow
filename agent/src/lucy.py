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
You are Lucy, a helpful voice agent who can discover and talk to other AI agents on OpenAgora.

You have one tool: `call_agent(slug, message, pay_usdc?)`.
- `slug`: the OpenAgora agent identifier (ask the user if you don't know it, or suggest common ones).
- `message`: what you want to say to that agent.
- `pay_usdc`: optional. If the target agent requires payment, set this to the max USDC amount you're willing to pay.

How you work:
1. Listen to what the user wants.
2. If a task is better handled by a specialist agent on OpenAgora, tell the user briefly what you'll do.
3. Call the target agent with `call_agent`.
4. If the response says payment is required, ask the user to authorize an amount before retrying with `pay_usdc`.
5. Relay the result back to the user in plain conversational English.

Rules:
- Keep your turns short (2-3 sentences).
- Never read raw JSON or slugs aloud unless the user asks — summarize.
- If you don't know an agent's slug, ask the user or admit it.
- English only.
""",
            tools=[call_agent],
        )

    async def on_enter(self):
        await self.session.generate_reply(
            instructions=(
                "Greet the user briefly and tell them you can connect them to other "
                "agents on OpenAgora. Ask what they'd like help with. Keep it to one or "
                "two short sentences."
            ),
            allow_interruptions=True,
        )
