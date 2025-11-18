from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime
import os
import json
from zep_cloud.client import Zep
from zep_cloud import Message
import logging
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Get Zep API key from environment
ZEP_API_KEY = os.getenv("ZEP_API_KEY", "").strip()

if not ZEP_API_KEY:
    raise ValueError("ZEP_API_KEY environment variable is required")

print(f"🔑 Zep API Key loaded: {ZEP_API_KEY[:5]}...{ZEP_API_KEY[-5:]}")
print(f"🔑 Key length: {len(ZEP_API_KEY)}")
print(f"🔑 Key starts with 'z_': {ZEP_API_KEY.startswith('z_')}")

# Initialize Zep client
zep = Zep(api_key=ZEP_API_KEY)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required")

print(f"🗄️ Supabase URL: {SUPABASE_URL}")
print(f"🔑 Supabase Key loaded: {SUPABASE_SERVICE_KEY[:5]}...{SUPABASE_SERVICE_KEY[-5:]}")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

@app.get("/")
async def root():
    return {
        "status": "Axmen Recycling Agent Memory Service Running",
        "timestamp": datetime.now().isoformat(),
        "zep_configured": bool(ZEP_API_KEY),
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Axmen Recycling Phone Agent",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/")
async def handle_vapi_webhook(request: Request):
    """Handle all incoming webhooks from Vapi"""
    try:
        payload = await request.json()
        
        # Get the message type
        message_type = payload.get("message", {}).get("type", "unknown")
        print(f"📨 Received webhook: {message_type}")
        
        # Handle assistant.started - when call begins
        if message_type == "assistant.started":
            phone_number = payload.get("message", {}).get("call", {}).get("customer", {}).get("number")
            if phone_number:
                print(f"📞 Call started for: {phone_number}")
            return JSONResponse(content={"status": "acknowledged"})
        
        # Handle tool-calls for material pricing and memory
        elif message_type in ["tool-calls", "function-call"]:
            print("🔍 Tool call received")
            
            message_data = payload.get("message", {})
            
            # The function data is in toolCallList or toolCalls
            tool_call_list = message_data.get("toolCallList", [])
            if not tool_call_list:
                tool_call_list = message_data.get("toolCalls", [])
            
            print(f"   📦 Tool call list: {json.dumps(tool_call_list, indent=2)}")
            
            # Get the first tool call
            if tool_call_list and len(tool_call_list) > 0:
                tool_call = tool_call_list[0]
                
                # Extract function details
                function_name = tool_call.get("function", {}).get("name")
                if not function_name:
                    function_name = tool_call.get("name")
                
                parameters = tool_call.get("function", {}).get("arguments", {})
                if not parameters:
                    parameters = tool_call.get("parameters", {})
                
                # Get phone number from call data
                phone_number = message_data.get("call", {}).get("customer", {}).get("number")
                
                print(f"   Function: {function_name}")
                print(f"   Phone: {phone_number}")
                print(f"   Parameters: {parameters}")
                
                # Handle memory retrieval function
                if function_name == "get_caller_history":
                    print(f"   🧠 Retrieving memory for: {phone_number}")
                    context = await get_caller_context(phone_number)
                    context["caller_phone"] = phone_number
                    print(f"   ✓ Memory retrieved: is_returning_caller={context.get('is_returning_caller')}")
                    return JSONResponse(content={
                        "result": context
                    })
                
                # Handle material pricing lookup function
                elif function_name == "lookup_material_price":
                    print(f"   💰 Looking up material pricing")
                    material = parameters.get("material")
                    
                    if not material:
                        print(f"   ❌ No material provided")
                        return JSONResponse(content={
                            "result": {
                                "success": False,
                                "error": "material is required"
                            }
                        })
                    
                    print(f"   Looking up: {material}")
                    
                    try:
                        # Search in material_pricing table
                        response = supabase.table("material_pricing") \
                            .select("*") \
                            .or_(f"question.ilike.%{material}%,intent.ilike.%{material}%") \
                            .eq("active", True) \
                            .order("priority", desc=True) \
                            .limit(1) \
                            .execute()
                        
                        if response.data and len(response.data) > 0:
                            result = response.data[0]
                            answer = result.get("answer_voice", result.get("answer_long", ""))
                            print(f"   ✓ Found in material_pricing: {answer[:100]}...")
                            return JSONResponse(content={
                                "result": answer
                            })
                        
                        # If not found, try recycle_knowledge table
                        response = supabase.table("recycle_knowledge") \
                            .select("*") \
                            .or_(f"question.ilike.%{material}%,intent.ilike.%{material}%") \
                            .eq("is_active", True) \
                            .order("priority", desc=True) \
                            .limit(1) \
                            .execute()
                        
                        if response.data and len(response.data) > 0:
                            result = response.data[0]
                            answer = result.get("answer_voice", result.get("answer_long", ""))
                            print(f"   ✓ Found in recycle_knowledge: {answer[:100]}...")
                            return JSONResponse(content={
                                "result": answer
                            })
                        
                        # Not found
                        print(f"   ⚠️ Material not found: {material}")
                        fallback = "I don't have specific pricing information for that material. Please call us at 406-543-1905 for current pricing."
                        return JSONResponse(content={
                            "result": fallback
                        })
                        
                    except Exception as e:
                        print(f"   ❌ Error querying Supabase: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return JSONResponse(content={
                            "result": "I'm having trouble looking that up right now. Please call us at 406-543-1905."
                        })
                
                # Handle other functions
                print(f"   ⚠️ Function not implemented: {function_name}")
                return JSONResponse(content={"result": "Function not implemented"})
            else:
                print(f"   ⚠️ No tool calls found in list")
                return JSONResponse(content={"result": "No tool calls found"})
        
        # Handle end-of-call-report for saving conversation
        elif message_type == "end-of-call-report":
            print("💾 End-of-call-report received")
            
            message_data = payload.get("message", {})
            print(f"   Top-level payload keys: {list(payload.keys())}")
            print(f"   Message keys: {list(message_data.keys())}")
            
            # Extract phone number from call.customer.number
            call_data = message_data.get("call", {})
            customer_data = call_data.get("customer", {})
            phone_number = customer_data.get("number")
            
            # Extract call ID
            call_id = call_data.get("id")
            
            # Get transcript/messages
            transcript = message_data.get("transcript", "")
            messages = message_data.get("messages", [])
            
            print(f"   ✓ Messages found at message level!")
            print(f"   Transcript length: {len(transcript)}")
            
            if messages:
                print(f"   First message keys: {list(messages[0].keys())}")
            
            if phone_number and (transcript or messages):
                print(f"\n📞 Processing call:")
                print(f"   Phone: {phone_number}")
                print(f"   Call ID: {call_id}")
                print(f"   Transcript length: {len(transcript)}")
                print(f"   Messages: {len(messages)}")
                
                try:
                    await save_conversation(phone_number, call_id, transcript, messages)
                    return JSONResponse(content={"status": "success", "message": "Conversation saved"})
                except Exception as e:
                    print(f"❌ Error in save_conversation: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    raise HTTPException(status_code=500, detail=str(e))
            else:
                print("⚠️ Missing required data:")
                print(f"   Phone: {phone_number}")
                print(f"   Transcript: {len(transcript) if transcript else 0}")
                print(f"   Messages: {len(messages) if messages else 0}")
                return JSONResponse(content={"status": "ignored", "reason": "missing_data"})
        
        # Handle other webhook types
        else:
            print(f"⚠️ Unhandled webhook type: {message_type}")
            return JSONResponse(content={"status": "ignored", "type": message_type})
            
    except Exception as e:
        print(f"❌ Error processing webhook: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def get_caller_context(phone_number: str) -> dict:
    """
    Retrieve conversation history and context for a returning caller.
    Returns a summary that Vapi can use to personalize the greeting.
    """
    try:
        # Check if this caller exists in Zep
        try:
            user = zep.user.get(user_id=phone_number)
            print(f"   ✓ Found existing user: {phone_number}")
        except Exception as e:
            # New caller - no history
            print(f"   ℹ New caller (no history): {phone_number}")
            return {
                "is_returning_caller": False,
                "summary": "First time caller - no previous conversation history."
            }
        
        # Get the user's sessions
        try:
            sessions = zep.user.get_sessions(user_id=phone_number)
            print(f"   ✓ Found {len(sessions) if sessions else 0} sessions for user")
        except Exception as e:
            print(f"   ℹ No sessions found: {e}")
            return {
                "is_returning_caller": False,
                "summary": "No previous conversations found."
            }
        
        if not sessions or len(sessions) == 0:
            print(f"   ℹ No sessions for user")
            return {
                "is_returning_caller": False,
                "summary": "No previous conversations found."
            }
        
        # Get the most recent session
        most_recent_session = sessions[0]
        session_id = most_recent_session.session_id
        
        print(f"   ✓ Found session: {session_id}")
        
        # Get memory/summary for this session
        try:
            memory = zep.memory.get(session_id=session_id)
            
            # Extract the relevant context
            context_parts = []
            
            # Add facts if available
            if memory.facts and len(memory.facts) > 0:
                facts_text = "; ".join([fact.fact for fact in memory.facts[:5]])
                context_parts.append(f"Key facts: {facts_text}")
            
            # Add summary if available
            if memory.summary and memory.summary.content:
                context_parts.append(f"Previous conversation: {memory.summary.content}")
            
            if context_parts:
                summary = " | ".join(context_parts)
            else:
                # Fallback: get last few messages
                messages = zep.message.list(session_id=session_id, limit=10)
                recent_messages = []
                for msg in messages[:5]:
                    role = "Customer" if msg.role == "user" else "Agent"
                    recent_messages.append(f"{role}: {msg.content[:100]}")
                summary = "Recent exchange: " + " | ".join(recent_messages)
            
            print(f"   ✓ Retrieved memory summary")
            return {
                "is_returning_caller": True,
                "summary": summary,
                "last_conversation": str(most_recent_session.created_at) if hasattr(most_recent_session, 'created_at') else "recent"
            }
            
        except Exception as e:
            print(f"   ⚠️ Error getting memory: {e}")
            # Fallback
            try:
                messages = zep.message.list(session_id=session_id, limit=5)
                if messages and len(messages) > 0:
                    summary = f"Returning caller. Last spoke about: {messages[0].content[:200]}"
                else:
                    summary = "Returning caller with previous conversation on file."
                
                return {
                    "is_returning_caller": True,
                    "summary": summary
                }
            except Exception as inner_e:
                print(f"   ⚠️ Error getting messages: {inner_e}")
                return {
                    "is_returning_caller": True,
                    "summary": "Returning caller with previous conversation on file."
                }
            
    except Exception as e:
        print(f"   ❌ Error retrieving caller context: {e}")
        import traceback
        traceback.print_exc()
        return {
            "is_returning_caller": False,
            "summary": "Unable to retrieve caller history."
        }


async def save_conversation(phone_number: str, call_id: str, transcript: str, messages: list):
    """
    Save conversation to Zep memory using session methods
    """
    try:
        print(f"\n💾 Saving conversation for: {phone_number}")
        
        # Use phone number as user_id
        user_id = phone_number
        
        # Create session_id combining phone and call_id for uniqueness
        session_id = f"axmen_{phone_number}_{call_id}"
        print(f"   Session: {session_id}")
        
        # Ensure user exists in Zep
        try:
            user = zep.user.get(user_id=user_id)
            print(f"   ✓ User exists in Zep")
        except Exception as e:
            print(f"   Creating new user in Zep: {user_id}")
            zep.user.add(
                user_id=user_id,
                first_name=phone_number,
                metadata={
                    "phone": phone_number,
                    "source": "axmen_recycling_agent"
                }
            )
            print(f"   ✓ Created new user in Zep: {user_id}")
        
        # Format messages for Zep with character limit
        MAX_MESSAGE_LENGTH = 2500  # Zep's limit
        zep_messages = []
        truncated_count = 0
        
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("message", "")
            
            # Map Vapi roles to Zep roles
            if role == "assistant":
                zep_role = "assistant"
            else:
                zep_role = "user"
            
            if content:
                # Truncate message if it exceeds Zep's limit
                if len(content) > MAX_MESSAGE_LENGTH:
                    content = content[:MAX_MESSAGE_LENGTH - 50] + "... [truncated]"
                    truncated_count += 1
                
                zep_messages.append(
                    Message(
                        role=zep_role,
                        content=content,
                        role_type="user" if zep_role == "user" else "assistant"
                    )
                )
        
        print(f"   Formatted messages: {len(zep_messages)}")
        if truncated_count > 0:
            print(f"   ⚠️ Truncated {truncated_count} messages that exceeded {MAX_MESSAGE_LENGTH} chars")
        
        if not zep_messages:
            print("   ⚠️ No messages to save")
            return
        
        print(f"   Session: {session_id}")
        print(f"   Messages: {len(zep_messages)}")
        
        # Add messages to session (this creates the session if it doesn't exist)
        try:
            zep.memory.add(
                session_id=session_id,
                messages=zep_messages
            )
            
            print(f"   ✓ Conversation saved successfully to session: {session_id}")
            print(f"   ✓ Messages saved: {len(zep_messages)}")
            
        except Exception as e:
            print(f"   ❌ Error saving messages: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to save conversation: {str(e)}")
        
    except Exception as e:
        print(f"❌ Error in save_conversation: {str(e)}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3002))
    uvicorn.run(app, host="0.0.0.0", port=port)
