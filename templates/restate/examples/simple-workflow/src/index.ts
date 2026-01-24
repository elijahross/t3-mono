import * as restate from "@restatedev/restate-sdk";
import { WorkflowContext, WorkflowSharedContext } from "@restatedev/restate-sdk";

/**
 * Simple Workflow Example
 *
 * Demonstrates:
 * - Basic workflow structure
 * - Durable execution with ctx.run()
 * - Idempotent workflow IDs
 * - State persistence
 */

interface GreetingInput {
  workflowId: string;
  name: string;
  language: string;
}

// Retry configuration
const retryConfig = {
  initialRetryInterval: { milliseconds: 1000 },
  retryIntervalFactor: 2,
  maxRetryInterval: { seconds: 5 },
  maxRetryAttempts: 3,
};

// Simulated external API call
async function fetchGreeting(language: string): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const greetings: Record<string, string> = {
    en: "Hello",
    es: "Hola",
    fr: "Bonjour",
    de: "Guten Tag",
    ja: "こんにちは",
  };

  return greetings[language] || greetings.en;
}

// Define the workflow
export const SimpleWorkflow = restate.workflow({
  name: "SimpleWorkflow",
  handlers: {
    /**
     * Main workflow handler
     * This executes exactly once per unique workflowId
     */
    run: async (ctx: WorkflowContext, input: GreetingInput): Promise<string> => {
      ctx.console.log(`Starting workflow: ${input.workflowId}`);

      // Step 1: Fetch greeting (durable - won't re-run on retry)
      const greeting = await ctx.run("fetch-greeting", retryConfig, async () => {
        ctx.console.log(`Fetching greeting for language: ${input.language}`);
        return await fetchGreeting(input.language);
      });

      // Step 2: Get timestamp (durable - ensures determinism)
      const timestamp = await ctx.run("get-timestamp", async () => {
        return new Date().toISOString();
      });

      // Step 3: Build final message
      const message = `${greeting}, ${input.name}! (${timestamp})`;

      ctx.console.log(`Workflow complete: ${message}`);

      return message;
    },

    /**
     * Get workflow status
     */
    getStatus: async (ctx: WorkflowSharedContext): Promise<{ status: string }> => {
      // This would typically check workflow state
      return { status: "completed" };
    },
  },
});

// Start the server
if (require.main === module) {
  const port = parseInt(process.env.PORT || "9084");

  restate
    .endpoint()
    .bind(SimpleWorkflow)
    .listen(port)
    .then(() => {
      console.log(`SimpleWorkflow listening on port ${port}`);
      console.log(`\nTry it:`);
      console.log(`  curl -X POST http://localhost:8080/SimpleWorkflow/run \\`);
      console.log(`    -H 'content-type: application/json' \\`);
      console.log(`    -d '{"workflowId": "greeting-1", "name": "Alice", "language": "en"}'`);
    });
}
