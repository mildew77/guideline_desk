"use client";

import { useState } from "react";

const initialResult = {
  title: "Ready to search the source library",
  answer:
    "Ask a mortgage-guideline question to search the official Fannie Mae and Freddie Mac sections loaded into your source library.",
  practical:
    "Answers are generated only from retrieved official excerpts and include links back to the source.",
  sources: [],
  meta: "Awaiting a question",
};

function renderCitations(answer, sources) {
  return answer.split(/(\[\d+\])/g).map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    const source = match ? sources[Number(match[1]) - 1] : null;
    return source ? (
      <a
        className="inline-citation"
        href={source.source_url}
        key={`${part}-${index}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open source ${part}: ${source.section_title}`}
      >
        {part}
      </a>
    ) : (
      part
    );
  });
}

export default function Home() {
  const [question, setQuestion] = useState(
    "What are the reserve requirements for a second home?",
  );
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function ask(value = question) {
    if (!value.trim() || loading) return;
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: value }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The research request failed.");
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }
  function choose(value) {
    setQuestion(value);
    ask(value);
  }
  async function copy() {
    await navigator.clipboard.writeText(
      `${result.title}\n\n${result.answer}\n\n${result.practical}`,
    );
    setCopied(true);
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#research" aria-label="Guideline Desk home">
          <span className="mark">⌂</span>
          <span>
            GUIDELINE
            <br />
            DESK
          </span>
        </a>
        <div className="topbar-right">
          <span className="source-status">
            <i /> Supabase RAG connected
          </span>
          <button className="icon-button" aria-label="Open settings">
            ⚙
          </button>
          <div className="avatar">MH</div>
        </div>
      </header>
      <section className="workspace" aria-labelledby="workspace-title">
        <aside className="sidebar">
          <button
            className="new-query"
            onClick={() => {
              setQuestion("");
              document.getElementById("question")?.focus();
            }}
          >
            ＋ <span>New question</span>
          </button>
          <nav aria-label="Research navigation">
            <a className="active" href="#research">
              <span>⌕</span> Research
            </a>
            <a href="#sources">
              <span>▣</span> Source library <b>{result.sources.length}</b>
            </a>
            <a href="#history">
              <span>◴</span> Recent questions
            </a>
          </nav>
          <div className="sidebar-bottom">
            <p>LIBRARY STATUS</p>
            <strong>
              <i /> Source-first
            </strong>
            <span>Fannie Mae + Freddie Mac</span>
            <small>Only retrieved text is used</small>
          </div>
        </aside>
        <div className="research" id="research">
          <section className="intro">
            <div>
              <p className="eyebrow">MORTGAGE GUIDELINE RESEARCH</p>
              <h1 id="workspace-title">
                Find the rule.
                <br />
                <em>See the source.</em>
              </h1>
            </div>
            <p className="intro-copy">
              Ask a lending scenario in plain English. Answers are grounded in
              retrieved Fannie Mae and Freddie Mac guidance.
            </p>
          </section>
          <section className="ask-card" aria-label="Ask a guideline question">
            <label htmlFor="question">What are you working through?</label>
            <div className="query-row">
              <input
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && ask()}
                aria-label="Mortgage guideline question"
              />
              <button onClick={() => ask()} disabled={loading}>
                {loading ? (
                  "Researching…"
                ) : (
                  <>
                    Ask guideline desk <span>→</span>
                  </>
                )}
              </button>
            </div>
            <div className="suggestions">
              <span>Try:</span>
              <button
                onClick={() =>
                  choose(
                    "What income documentation is required for a self-employed borrower?",
                  )
                }
              >
                Self-employed income
              </button>
              <button
                onClick={() =>
                  choose("Can gift funds be used for a down payment?")
                }
              >
                Gift funds
              </button>
              <button
                onClick={() =>
                  choose(
                    "What are the requirements for a property with an accessory dwelling unit?",
                  )
                }
              >
                Accessory dwelling unit
              </button>
            </div>
          </section>
          {error && (
            <p role="alert" style={{ color: "#994127", marginTop: "18px" }}>
              {error}
            </p>
          )}
          <div className="content-grid">
            <section className="answer-panel" aria-live="polite">
              <div className="answer-head">
                <div>
                  <p className="eyebrow">GROUNDED ANSWER</p>
                  <h2>{result.title}</h2>
                </div>
                <span className="confidence">
                  ● {result.sources.length ? "Source-backed" : "No source yet"}
                </span>
              </div>
              <div className="answer-body">
                <p>{renderCitations(result.answer, result.sources)}</p>
                <div className="callout">
                  <span>↗</span>
                  <p>
                    <strong>Practical read:</strong> {result.practical}
                  </p>
                </div>
                <p className="fine-print">
                  This research summary is not an underwriting decision. Confirm
                  the cited guide and applicable AUS findings before approving a
                  loan.
                </p>
              </div>
              <div className="answer-footer">
                <span>{result.meta}</span>
                <button className="copy-button" onClick={copy}>
                  {copied ? "✓ Copied" : "▣ Copy answer"}
                </button>
              </div>
            </section>
            <aside className="sources-panel" id="sources">
              <div className="sources-heading">
                <div>
                  <p className="eyebrow">RETRIEVED SOURCES</p>
                  <h2>Read in context</h2>
                </div>
                <span className="result-count">
                  {result.sources.length} results
                </span>
              </div>
              {result.sources.length ? (
                result.sources.map((source, index) => (
                  <a
                    className={`source-card ${source.agency === "Fannie Mae" ? "fannie" : "freddie"}`}
                    target="_blank"
                    rel="noreferrer"
                    href={source.source_url}
                    key={source.id}
                  >
                    <div className="source-top">
                      <span className="source-badge">{source.agency}</span>
                      <span className="source-link-icon">↗</span>
                    </div>
                    <h3>
                      <span className="source-citation">[{index + 1}]</span>{" "}
                      {source.section_id}, {source.section_title}
                    </h3>
                    <p>
                      {source.content.slice(0, 180)}
                      {source.content.length > 180 ? "…" : ""}
                    </p>
                    <small>
                      {source.guide_name}
                      {source.effective_date
                        ? ` · Effective ${source.effective_date}`
                        : ""}
                    </small>
                  </a>
                ))
              ) : (
                <p className="citation-note">
                  Sources will appear here after the first successful retrieval.
                  The app intentionally does not answer from memory.
                </p>
              )}
              <p className="citation-note">
                Citations link directly to official source pages. Always verify
                the effective date.
              </p>
            </aside>
          </div>
        </div>
      </section>
      <footer>
        <span>GUIDELINE DESK</span>
        <span>Research assistant · Not a substitute for underwriting</span>
        <span>Built for source-first decisions</span>
      </footer>
    </main>
  );
}
