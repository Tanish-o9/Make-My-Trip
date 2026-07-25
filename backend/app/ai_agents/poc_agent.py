from langgraph.graph import StateGraph, END
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router

@log_agent_execution("poc_agent")
def greeting_node(state: AgentState) -> dict:
    """Greets the user and answers simple messages using the router"""
    messages = state.get("messages", [])
    user_message = messages[-1]["content"] if messages else "Hello"
    
    prompt = f"Write a helpful, enthusiastic greeting responding to: '{user_message}'"
    system_prompt = "You are a friendly AI Travel assistant helping to greet a traveler."
    
    # Run through the router
    response = llm_router.complete(
        prompt=prompt,
        system_prompt=system_prompt,
        task_type="simple",
        trace_id=state.get("trace_id", "poc_trace")
    )
    
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }

# Build the POC workflow graph
workflow = StateGraph(AgentState)
workflow.add_node("greeter", greeting_node)
workflow.set_entry_point("greeter")
workflow.add_edge("greeter", END)

poc_agent_graph = workflow.compile()
