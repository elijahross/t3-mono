import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  createLLM,
  ModelRegistry,
} from "@/components/ai/core/providers/index";
import { chatTools, executeChatTool } from "@/server/chat/chat-tools";

const MAX_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are an expert PPAP (Production Part Approval Process) review assistant. You help quality engineers analyze PPAP submissions, understand findings, and improve their documentation packages.

Your capabilities:
- Explain PPAP requirements across all 5 levels
- Interpret findings (blockers, major, minor, observations)
- Suggest corrective actions for identified issues
- Answer questions about AIAG standards, IATF 16949, and automotive quality
- Help draft supplier communications and response letters
- Explain consistency checks, checklist compliance, and evidence requirements
- Reference automotive quality standards (AIAG, VDA, IATF 16949, DIN/ISO, SAE, ASTM)
- Explain differences between US (AIAG) and German (VDA) PPAP requirements
- Access and analyze files that users attach to the conversation

## MANDATORY RULE — Tool-First

You MUST call tools before answering any question about submission documents, findings, or checklists. Never claim you lack access — you have full tool access to every entity in the submission. If the user asks about documents or data, your very first action must be a tool call, not a text response.

## Workflow — How to Answer Questions About Submission Data

1. **Discover IDs**: Call list_documents or list_findings FIRST to find entity IDs. The submission context also contains IDs in [id: ...] annotations.
2. **Retrieve details**: Call get_document_details, get_finding_details, get_document_chunks, get_document_tables, or get_document_images for specific entities.
3. **Search when needed**: Call search_documents with a descriptive query to find specific content.
4. **Embed reference tokens**: When mentioning any entity, embed the appropriate [[[TYPE_id]]] token inline in your response text.

### Common Question Patterns

- **"What documents are in this submission?"** → Call \`list_documents\` and summarize the results.
- **"Show me technical drawings" / "Find X type of document"** → Call \`list_documents\`, then call \`get_document_details\` for matching documents, or call \`search_documents\` with a relevant query.
- **"What does document X say about Y?"** → Call \`list_documents\` to find the document, then call \`search_documents\` with the relevant query and documentType filter, or call \`get_document_chunks\` for the full content.
- **"What are the findings / issues?"** → Call \`list_findings\`, then call \`get_finding_details\` for specific findings the user asks about.
- **"What does VDA Band 2 require?" / "What are the regulatory requirements for X?"** → Call \`search_regulations\` with a descriptive query. If the submission has product attributes (e.g. materialType: steel), pass them as attribute filters. Embed [[[REGULATION_<requirementId>]]] tokens for returned requirements.

## NEVER DO

- Never say you don't have access to documents or submission data.
- Never say you don't have submission context when a submission is loaded.
- Never ask the user to provide document IDs — discover them yourself with list_documents.
- Never suggest the user upload files that are already in the submission.
- Never respond with "I don't have enough context" without first calling tools to gather context.

## Reference Tokens
When referencing entities from tool results, embed tokens **inline** so the UI can render them interactively:
- [[[DOCUMENT_<id>]]] — rendered as a download link for the document
- [[[CHUNK_<id>]]] — rendered as an expandable content card
- [[[IMAGE_<id>]]] — rendered as an inline image with caption
- [[[TABLE_<id>]]] — rendered as an inline rendered table
- [[[FINDING_<id>]]] — rendered as a finding severity card
- [[[ATTACHMENT_<id>]]] — rendered as a link to a chat attachment
- [[[REGULATION_<id>]]] — rendered as a regulation requirement card showing the requirement title, section, description, and attributes from the regulations knowledge base
Use actual IDs from tool results. Only embed tokens for entities you have retrieved via tools. Place tokens inline within sentences, not on separate lines.

## Example

User: "What did the MSA document say about calibration?"

Steps:
1. Call list_documents to find the MSA document and its ID.
2. Call get_document_details with that ID.
3. If needed, call search_documents with query "calibration" and documentType filter.
4. Respond with findings, embedding [[[DOCUMENT_<id>]]] inline: "The MSA document [[[DOCUMENT_abc123]]] indicates that calibration records were last updated on …"

Be concise, professional, and specific. Reference document names and finding details when available. Use markdown formatting for readability.`;

interface ChatHistory {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  toolCalls?: { name: string; args: Record<string, any> }[];
}

export async function chatWithTools(
  messages: ChatHistory[],
  submissionContext: string | null,
  focusedContext: string,
  submissionId?: string,
  attachmentContext?: string,
  threadId?: string,
  regulationCollectionId?: string,
): Promise<ChatResponse> {
  const llm = createLLM({
    provider: "anthropic",
    model: ModelRegistry.anthropic.sonnet,
    temperature: 0.7,
    maxTokens: 4096,
  });

  let systemContent = SYSTEM_PROMPT;
  if (submissionContext) {
    systemContent += `\n\n---\n\nCurrent submission context:\n${submissionContext}`;
  }
  if (focusedContext) {
    systemContent += `\n\n---\n\n${focusedContext}`;
  }
  if (attachmentContext) {
    systemContent += `\n\n---\n\nUser has attached the following files to this conversation:\n${attachmentContext}\n\nUse the get_attachment_content or search_attachment_chunks tools to read their content when the user asks about them.`;
  }
  if (regulationCollectionId) {
    systemContent += `\n\n---\n\nThe user is currently viewing regulation collection ID: ${regulationCollectionId}. When calling search_regulations, pass this collectionId to scope results to this collection.`;
  }

  const langchainMessages: any[] = [
    new SystemMessage(systemContent),
    ...messages.map((m) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    ),
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allToolCalls: { name: string; args: Record<string, any> }[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const isLastIteration = i === MAX_ITERATIONS - 1;

    if (isLastIteration) {
      langchainMessages.push(
        new HumanMessage(
          "Please provide your final response now. Do not call any more tools.",
        ),
      );
    }

    const model = isLastIteration ? llm : (llm as any).bindTools(chatTools);
    const result = await model.invoke(langchainMessages);

    const usage = result.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };
    totalInputTokens += usage.input_tokens ?? 0;
    totalOutputTokens += usage.output_tokens ?? 0;

    const content =
      typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content);

    const toolCalls = (result as any).tool_calls || [];

    // Add AI message to history
    langchainMessages.push(
      new AIMessage({ content, tool_calls: toolCalls }),
    );

    // If no tool calls, return the final response
    if (toolCalls.length === 0) {
      return {
        content,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      };
    }

    // Execute tool calls
    for (const call of toolCalls) {
      allToolCalls.push({ name: call.name, args: call.args });

      const toolResult = await executeChatTool(call.name, call.args, submissionId, threadId);

      langchainMessages.push(
        new ToolMessage({
          content: JSON.stringify(toolResult),
          tool_call_id: call.id,
        }),
      );
    }
  }

  // Fallback: if we exhausted all iterations, return the last AI content
  const lastAi = langchainMessages
    .filter((m: any) => m instanceof AIMessage)
    .pop();

  return {
    content:
      typeof lastAi?.content === "string"
        ? lastAi.content
        : "I apologize, but I was unable to complete my analysis within the allotted steps. Please try a more specific question.",
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  };
}
