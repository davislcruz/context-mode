import "./setup-home";
import { it, expect, vi } from "vitest";

// Pi loads the extension again in the same process for an in-process subagent.
// Each instance must close the bridge child it started, whoever shuts down first.
it.each(["parent", "child"])("shutting down the %s first orphans no bridge child", async (first) => {
  const bridge = await import("../src/adapters/pi/mcp-bridge.js");
  const live = new Set<number>();
  let n = 0;
  vi.spyOn(bridge, "bootstrapMCPTools").mockImplementation((async () => {
    const id = ++n;
    live.add(id);
    return { shutdown: () => live.delete(id) };
  }) as any);

  const { default: extension } = await import("../src/adapters/pi/extension.js");
  const open = async () => {
    const handlers: Record<string, (...a: any[]) => any> = {};
    await extension({ on: (e: string, h: any) => { handlers[e] = h; }, registerCommand() {}, registerTool() {} });
    await handlers.before_agent_start({ prompt: "", systemPrompt: "" }, { hasUI: false });
    return handlers.session_shutdown;
  };
  const stop = { parent: await open(), child: await open() };
  expect(live.size).toBe(2);

  await stop[first as "parent" | "child"]();
  await stop[first === "parent" ? "child" : "parent"]();
  expect([...live]).toEqual([]);
});
