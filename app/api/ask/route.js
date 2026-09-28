import { NextResponse } from "next/server";
import { getOpenAI, getSupabaseAdmin } from "../../../lib/server-clients";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { question } = await request.json();
    if (typeof question !== "string" || question.trim().length < 4) {
      return NextResponse.json(
        { error: "Enter a more specific mortgage-guideline question." },
        { status: 400 },
      );
    }

    const openai = getOpenAI();
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question.trim(),
      dimensions: 1536,
    });
    const { data: sources, error: retrievalError } =
      await getSupabaseAdmin().rpc("match_guideline_chunks", {
        query_embedding: embedding.data[0].embedding,
        match_count: 6,
        agency_filter: null,
      });
    if (retrievalError) throw retrievalError;

    if (!sources?.length) {
      return NextResponse.json({
        title: "No verified guideline content yet",
        answer:
          "The source library is empty. Import Fannie Mae and Freddie Mac guideline sections before using this research assistant.",
        practical:
          "The app will not invent an answer when it cannot retrieve an official source.",
        sources: [],
        meta: "0 supporting sections",
      });
    }

    const context = sources
      .map(
        (source, index) =>
          `[${index + 1}] ${source.agency} · ${source.section_id}, ${source.section_title}\nEffective: ${source.effective_date ?? "not provided"}\n${source.content}`,
      )
      .join("\n\n");
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      store: false,
      reasoning: { effort: "minimal" },
      instructions:
        "You are a mortgage-guideline research assistant. Answer only from the retrieved official excerpts. Do not use outside knowledge or infer missing requirements. Cite supporting excerpts with [1], [2], and so on. If the excerpts do not answer the question, say that clearly. Always provide a plain-text answer. Keep the answer concise and factual. This is research support, not an underwriting decision.",
      input: `Question: ${question.trim()}\n\nRetrieved official excerpts:\n${context}`,
      max_output_tokens: 900,
    });
    const answer =
      response.output_text.trim() ||
      "The relevant official excerpts are retrieved below. Review the cited LTV guidance and its effective date before making an underwriting decision.";
    return NextResponse.json({
      title: "Guideline research result",
      answer,
      practical:
        "Review the cited guide sections and effective dates before making an underwriting decision.",
      sources,
      meta: `${sources.length} supporting section${sources.length === 1 ? "" : "s"} · source-backed`,
    });
  } catch (error) {
    console.error("RAG request failed:", error);
    return NextResponse.json(
      {
        error:
          "The research service could not complete this request. Check server configuration and try again.",
      },
      { status: 500 },
    );
  }
}
