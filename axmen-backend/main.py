from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime
import hmac
import os
from zep_cloud.client import Zep
from zep_cloud import Message
import logging

# End-of-call processor: receives Vapi's assistant-level webhooks and writes
# call transcripts to Zep memory, keyed by caller phone number. That is its
# only job — tool calls are handled by the Vercel functions in api/vapi/.

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Vapi webhook shared secret. Vapi sends this in the `x-vapi-secret` header
# (canonical: VapiAI/example-webhook-handler:src/utils/auth.js).
VAPI_SECRET = os.getenv("VAPI_SECRET", "").strip()
if not VAPI_SECRET:
    raise ValueError("VAPI_SECRET environment variable is required")


def require_vapi_secret(request: Request) -> None:
    """Raise 401 if the x-vapi-secret header is missing or doesn't match."""
    provided = request.headers.get("x-vapi-secret", "")
    if not hmac.compare_digest(provided, VAPI_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")


ZEP_API_KEY = os.getenv("ZEP_API_KEY", "").strip()
if not ZEP_API_KEY:
    raise ValueError("ZEP_API_KEY environment variable is required")

zep = Zep(api_key=ZEP_API_KEY)


@app.get("/")
async def root():
    return {
        "status": "Axmen Recycling Agent Memory Service Running",
        "timestamp": datetime.now().isoformat(),
        "zep_configured": bool(ZEP_API_KEY),
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Axmen Recycling Phone Agent",
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/")
async def handle_vapi_webhook(request: Request):
    """Handle incoming webhooks from Vapi. Only end-of-call-report does work;
    everything else is acknowledged and ignored."""
    require_vapi_secret(request)

    payload = await request.json()
    message_data = payload.get("message", {})
    message_type = message_data.get("type", "unknown")
    logger.info(f"📨 Received webhook: {message_type}")

    if message_type != "end-of-call-report":
        return JSONResponse(content={"status": "ignored", "type": message_type})

    call_data = message_data.get("call", {})
    phone_number = call_data.get("customer", {}).get("number")
    call_id = call_data.get("id")
    transcript = message_data.get("transcript", "")
    messages = message_data.get("messages", [])

    if not phone_number or not (transcript or messages):
        logger.warning(
            f"⚠️ Missing required data: phone={phone_number}, "
            f"transcript={len(transcript)}, messages={len(messages)}"
        )
        return JSONResponse(content={"status": "ignored", "reason": "missing_data"})

    logger.info(
        f"📞 Processing call: phone={phone_number}, call_id={call_id}, "
        f"messages={len(messages)}"
    )

    # A failed save is our problem, not Vapi's — returning 5xx just makes Vapi
    # retry/log an error against the assistant. Log it and acknowledge.
    try:
        save_conversation(phone_number, call_id, messages)
        return JSONResponse(content={"status": "success", "message": "Conversation saved"})
    except Exception as e:
        logger.exception(f"❌ Failed to save conversation for {phone_number}: {e}")
        return JSONResponse(content={"status": "error", "reason": str(e)})


def save_conversation(phone_number: str, call_id: str, messages: list) -> None:
    """Save conversation to Zep memory (V3 API: zep.memory.add)."""
    user_id = phone_number
    session_id = f"axmen_{phone_number}_{call_id}"

    # Ensure user exists in Zep
    try:
        zep.user.get(user_id=user_id)
        logger.info(f"   ✓ User exists in Zep: {user_id}")
    except Exception:
        zep.user.add(
            user_id=user_id,
            first_name=phone_number,
            metadata={
                "phone": phone_number,
                "source": "axmen_recycling_agent",
            },
        )
        logger.info(f"   ✓ Created new user in Zep: {user_id}")

    # Format messages for Zep with character limit
    MAX_MESSAGE_LENGTH = 2500  # Zep's limit
    zep_messages = []
    truncated_count = 0

    for msg in messages:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        content = msg.get("message", "")
        if not content:
            continue
        if len(content) > MAX_MESSAGE_LENGTH:
            content = content[: MAX_MESSAGE_LENGTH - 50] + "... [truncated]"
            truncated_count += 1
        zep_messages.append(Message(role=role, content=content, role_type=role))

    if truncated_count:
        logger.warning(f"   ⚠️ Truncated {truncated_count} messages over {MAX_MESSAGE_LENGTH} chars")

    if not zep_messages:
        logger.warning("   ⚠️ No messages to save")
        return

    # V3 API: adding messages creates the session if it doesn't exist
    zep.memory.add(session_id=session_id, messages=zep_messages)
    logger.info(f"   ✓ Saved {len(zep_messages)} messages to session {session_id}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 3002))
    uvicorn.run(app, host="0.0.0.0", port=port)
