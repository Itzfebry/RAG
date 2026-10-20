import asyncio

from backend.agent.agent import AgentOrchestrator


async def test_system():
    orchestrator = AgentOrchestrator()
    query = "Jelaskan langkah-langkah setting AI admin"
    history = []

    print(f"Testing Query: {query}")

    response_content = ""
    async for chunk in orchestrator.stream_chat_response(query, history):
        if "content" in chunk and "data: " in chunk:
            try:
                import json

                content = json.loads(chunk.split("data: ")[1])
                if "content" in content:
                    response_content += content["content"]
            except:
                pass

    print(f"Response:\n{response_content}")
    print("\nAnalysis:")

    score = 0
    if "1." in response_content or "-" in response_content:
        print("- [PASS] Formatting: Bullet/Numbering used.")
        score += 5
    else:
        print("- [FAIL] Formatting: No bullet/numbering detected.")

    if len(response_content) > 100:
        print("- [PASS] Response length: Detailed.")
        score += 3
    else:
        print("- [WARN] Response length: Too short.")

    print(f"\nTotal Score: {score}/8")


if __name__ == "__main__":
    asyncio.run(test_system())
