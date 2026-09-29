import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { HindsightClient } from "@vectorize-io/hindsight-client";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

const hindsight = new HindsightClient({
  baseUrl: process.env.HINDSIGHT_BASE_URL!,
  apiKey: process.env.HINDSIGHT_API_KEY!
});

const BANK_ID = process.env.HINDSIGHT_BANK_ID || "memorydesk";

app.get("/", (_req, res) => {
  res.json({
    project: "MemoryDesk",
    team: "Chaos & Co.",
    status: "running"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, customerId = "demo-customer" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Store the current customer interaction in Hindsight.
    await hindsight.retain(
      BANK_ID,
      `Customer ${customerId} said: ${message}`,
      {
        context: "MemoryDesk customer support conversation",
        metadata: {
          customerId
        }
      }
    );

    // Retrieve relevant previous memories.
    const recall = await hindsight.recall(
      BANK_ID,
      `What do we know about customer ${customerId} related to this issue: ${message}`,
      {
        maxTokens: 3000,
        budget: "mid"
      }
    );

    // Ask Hindsight to reason over the customer's accumulated history.
    const reflection = await hindsight.reflect(
      BANK_ID,
      `You are MemoryDesk, an empathetic customer-support agent.

Customer ID: ${customerId}

Current customer message:
"${message}"

Use the customer's previous memories and interaction history.

Give a concise, helpful support response.
If there is relevant previous troubleshooting history, mention it naturally.
Do not invent facts that are not supported by the customer's history.
If there is not enough information, ask a useful follow-up question.`,
      {
        budget: "mid"
      }
    );

    return res.json({
      response: reflection.text,
      memories: recall.results.map((memory) => ({
        type: memory.type,
        text: memory.text
      })),
      basedOn: reflection.based_on
    });
  } catch (error) {
    console.error("MemoryDesk error:", error);

    return res.status(500).json({
      error: "Something went wrong",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(PORT, () => {
  console.log(`MemoryDesk backend running at http://localhost:${PORT}`);
});
