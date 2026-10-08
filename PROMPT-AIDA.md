# AIDA system prompt — redacted

The production system prompt is intentionally withheld from this public research
repository. No production instructions are included in this file or in the
application source.

The public application reads a user-supplied system prompt from the server-side
`AIDA_SYSTEM_PROMPT` environment variable. Configure your own prompt locally;
never commit it to this repository. If the variable is missing, answer generation
fails before sending a request to the model.

The context assembly, retrieval code, and model request structure remain available
in `src/lib/llm-request.ts` for inspection. Providing a different prompt does not
reproduce the exact production answer-generation configuration reported in the
paper.
