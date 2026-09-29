import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { HindsightClient } from "@vectorize-io/hindsight-client";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.HINDSIGHT_BASE_URL!;
const BANK_ID = process.env.HINDSIGHT_BANK_ID || "memorydesk";

const hindsight = new HindsightClient({
  baseUrl: BASE_URL,
  apiKey: process.env.HINDSIGHT_API_KEY!
});

function authHeaders() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.HINDSIGHT_API_KEY}`
  };
}

/* ---------------- HOME ---------------- */

app.get("/", (_req, res) => {
  res.json({
    project: "MemoryDesk",
    team: "Chaos & Co.",
    status: "running"
  });
});

/* ---------------- CHAT ---------------- */

app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      customerId = "demo-customer"
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    /* ---------------------------------
       1. RETAIN CURRENT INTERACTION
       --------------------------------- */

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

    /* ---------------------------------
       2. RECALL RELEVANT MEMORY
       --------------------------------- */

    const recall = await hindsight.recall(
      BANK_ID,
      `What useful previous support context do we know about customer ${customerId} that is relevant to this issue: ${message}`,
      {
        maxTokens: 3000,
        budget: "mid"
      }
    );

    /* ---------------------------------
       3. REFLECT + GENERATE RESPONSE
       --------------------------------- */

    const reflection = await hindsight.reflect(
      BANK_ID,
      `You are MemoryDesk — a warm, confident, energetic human-like customer-support specialist.

Your goal is not just to answer the current message.
Your goal is to make support better because you remember what happened before.

PERSONALITY:
- Sound like a friendly, experienced human support teammate.
- Be warm, confident, expressive and conversational.
- Be energetic without sounding childish or cheesy.
- Use natural phrases such as:
  "Hey! Welcome back."
  "Ah, got it — that helps."
  "Okay, now we're getting somewhere."
  "Perfect, that narrows it down."
  "Let's sort this out."
  "Good news — we can pick up where we left off."
- Use occasional exclamation marks naturally.
- Never sound robotic, scripted, or overly formal.
- Never say "As an AI."
- Do not repeatedly say "I'm sorry to hear that."

MEMORY IS THE STAR:
- Treat previous interactions as valuable support history.
- Use relevant previous memory to avoid making the customer repeat information.
- If the customer is returning, make the memory benefit noticeable.
- Naturally say things like:
  "I remember you mentioned..."
  "Last time, we tried..."
  "We're picking up where we left off."
  "You already tried that, so let's not make you repeat it."
- Do not merely repeat old memories.
- Use previous outcomes to choose a better next step.
- If a previous troubleshooting step failed, avoid blindly suggesting the same thing again.
- Combine old context with new information from the current interaction.
- The customer should feel that MemoryDesk actually knows their support story.

RESPONSE STYLE:
- Keep the response concise and easy to scan.
- Use 2–4 short paragraphs rather than one large paragraph.
- When listing actions, put each bullet on its own line.
- Never put multiple bullets on one line.
- Ask ONE focused question at a time.
- Give at most 1–2 useful next actions unless the customer asks for more.
- Avoid unnecessary technical jargon.
- Do not dump raw memory records into the response.
- Never expose internal reasoning.
- Never mention APIs, Hindsight, memory retrieval, or internal processing unless the customer explicitly asks.

FIRST-TIME CUSTOMER:
- Be welcoming.
- Use only information provided in the current conversation.
- Do not pretend to know anything that has not been provided.

RETURNING CUSTOMER:
- Make the remembered context obvious but natural.
- Do not recite every memory.
- Mention only the details that help solve the current issue.

WHEN NEW INFORMATION APPEARS:
- Treat it as an update to the ongoing support case.
- Use the new information together with previous memory.
- Explain naturally when the new detail changes the troubleshooting direction.

WHEN SOMETHING HAS ALREADY FAILED:
- Do not repeatedly recommend the same failed action.
- Acknowledge what was already attempted.
- Move toward a new diagnostic step.

WHEN THE CUSTOMER ASKS WHAT WAS TRIED:
Use a clean summary.

Example:
"So far, we've tried:

• Restarting the router
• Checking whether other devices are affected

The router restart didn't solve it, so I wouldn't make you repeat that."

IMPORTANT FACTUAL RULES:
- Never invent facts.
- Never invent previous troubleshooting steps.
- Never invent customer preferences.
- Never claim something worked unless the customer confirmed it.
- Never claim the issue is solved without confirmation.
- Never exaggerate certainty.
- If the previous memory is not relevant, simply answer the current question normally.

THE FEELING WE WANT:
The customer should think:
"Wow, it actually remembers me."
"Nice — I don't have to explain everything again."
"It knows what we already tried."

Current customer message:
"${message}"

Use relevant accumulated history to make this response noticeably more useful than a generic first-time support response.`,
      {
        budget: "mid"
      }
    );

    /* ---------------------------------
       4. RETURN RESPONSE
       --------------------------------- */

    return res.json({
      response: reflection.text,
      memories: (recall.results || []).map((memory: any) => ({
        type: memory.type,
        text: memory.text
      }))
    });

  } catch (error) {
    console.error("MemoryDesk chat error:", error);

    return res.status(500).json({
      error: "Something went wrong",
      details:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
});

/* ---------------- HISTORY ---------------- */

/*
  History is intentionally separate from chat.
  The frontend only requests it when the user
  clicks the History tab.
*/

app.get("/api/history", async (_req, res) => {
  try {
    const url =
      `${BASE_URL}/v1/default/banks/${encodeURIComponent(BANK_ID)}` +
      `/memories/list?limit=100`;

    const response = await fetch(url, {
      headers: authHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail?.[0]?.msg ||
        data?.message ||
        "Failed to load Hindsight history"
      );
    }

    const rawMemories =
      Array.isArray(data)
        ? data
        : data.memories ||
        data.results ||
        data.items ||
        [];

    const memories = rawMemories
      .map((memory: any) => ({
        type:
          memory.type ||
          memory.fact_type ||
          memory.kind ||
          "memory",

        text:
          memory.text ||
          memory.content ||
          memory.fact ||
          ""
      }))
      .filter((memory: any) => memory.text);

    return res.json({
      memories
    });

  } catch (error) {
    console.error("History load error:", error);

    return res.status(500).json({
      error: "Could not load Hindsight history",
      details:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
});

/* ---------------- CLEAR HISTORY ---------------- */

app.delete("/api/history", async (_req, res) => {
  try {
    const url =
      `${BASE_URL}/v1/default/banks/${encodeURIComponent(BANK_ID)}` +
      `/memories`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: authHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail?.[0]?.msg ||
        data?.message ||
        "Failed to clear Hindsight history"
      );
    }

    return res.json({
      success: true,
      message: "MemoryDesk history cleared"
    });

  } catch (error) {
    console.error("History clear error:", error);

    return res.status(500).json({
      error: "Could not clear Hindsight history",
      details:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(
    `MemoryDesk backend running at http://localhost:${PORT}`
  );
});