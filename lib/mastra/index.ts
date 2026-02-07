import { Mastra } from "@mastra/core";
import { neuroAgent } from "@/lib/mastra/agents/neuro-agent";

// Mastra 인스턴스 (싱글톤)
export const mastra = new Mastra({
  agents: {
    neuro: neuroAgent,
  },
});
