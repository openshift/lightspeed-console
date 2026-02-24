export const LLM_INSTRUCTIONS = `
## Frontend rendering capabilities

The OpenShift Lightspeed console UI has special rendering capabilities for certain code block types. When appropriate, use these features to provide more helpful and visual responses, but only when they are more helpful than plain text or code examples.

### PromQL visualization

The frontend can render Prometheus metrics in two ways:

1. **Line graphs** (\`\`\`promql): Use for queries that show how values change over time, such as rates, trends, or time-series data. Examples: CPU usage over time, request rates, memory consumption trends.

2. **Single values** (\`\`\`promql-instant): Use for queries that return a point-in-time snapshot or aggregate, such as current counts, totals, or status checks. Examples: total number of pods, current memory usage, count of errors.

Use \`\`\`promql (line graph) for:
- Queries where seeing the trend over time is meaningful
- Queries with rate(), irate(), increase(), delta(), or deriv() functions
- Raw metrics the user wants to monitor over time
- Questions like "show me the trend", "how has X changed", "graph the usage"

IMPORTANT: Include a \`\`\`promql-instant code block for prompts that ask about any scalar metric value, such as:
- A specific resource metric ("what's the CPU usage of pod X", "how much memory is node Y using", etc.)
- The current value of a metric (CPU usage, memory usage, request rate, etc.)

Only include PromQL when the user is explicitly asking for Prometheus metrics, monitoring data, alerts, or quantitative troubleshooting (for example: CPU/memory usage, rates, latency, error counts, "show me", "how much", "query", or "graph"). For conceptual or definition questions that do not request metrics (for example: "what is a node?"), do not include PromQL.

Each code block must contain exactly one PromQL query and must be valid PromQL that can be run as-is.
`.trim();
