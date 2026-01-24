import * as restate from "@restatedev/restate-sdk";
import { Context } from "@restatedev/restate-sdk";
import { z } from "zod";
import {
  LambdaClient,
  InvokeCommand,
  InvokeAsyncCommand,
  GetFunctionCommand,
  ListFunctionsCommand,
} from "@aws-sdk/client-lambda";

// Configuration
const config = {
  region: process.env.AWS_REGION || "us-east-1",
  maxRetries: parseInt(process.env.MAX_RETRIES || "5"),
};

const lambdaClient = new LambdaClient({ region: config.region });

// Retry configuration
const retryConfig = {
  initialRetryInterval: { milliseconds: 1000 },
  retryIntervalFactor: 2,
  maxRetryInterval: { seconds: 5 },
  maxRetryAttempts: config.maxRetries,
  maxRetryDuration: { minutes: 1 },
};

// Schemas
const InvokeFunctionInputSchema = z.object({
  functionName: z.string(),
  payload: z.any(),
  invocationType: z.enum(["RequestResponse", "Event", "DryRun"]).optional().default("RequestResponse"),
  logType: z.enum(["None", "Tail"]).optional().default("None"),
});

const InvokeAsyncInputSchema = z.object({
  functionName: z.string(),
  payload: z.any(),
});

const GetFunctionInputSchema = z.object({
  functionName: z.string(),
});

type InvokeFunctionInput = z.infer<typeof InvokeFunctionInputSchema>;
type InvokeAsyncInput = z.infer<typeof InvokeAsyncInputSchema>;
type GetFunctionInput = z.infer<typeof GetFunctionInputSchema>;

// Service
export const AWSLambdaService = restate.service({
  name: "AWSLambdaService",
  handlers: {
    invokeFunction: async (ctx: Context, input: InvokeFunctionInput) => {
      const validated = InvokeFunctionInputSchema.parse(input);

      const result = await ctx.run(`invoke-${validated.functionName}`, retryConfig, async () => {
        const command = new InvokeCommand({
          FunctionName: validated.functionName,
          Payload: JSON.stringify(validated.payload),
          InvocationType: validated.invocationType,
          LogType: validated.logType,
        });

        const response = await lambdaClient.send(command);

        const payload = response.Payload
          ? JSON.parse(new TextDecoder().decode(response.Payload))
          : null;

        return {
          statusCode: response.StatusCode,
          payload,
          executedVersion: response.ExecutedVersion,
          logResult: response.LogResult
            ? Buffer.from(response.LogResult, "base64").toString("utf-8")
            : undefined,
          functionError: response.FunctionError,
        };
      });

      ctx.console.info({
        service: "AWSLambdaService",
        action: "invokeFunction",
        functionName: validated.functionName,
        statusCode: result.statusCode,
        error: result.functionError,
      });

      if (result.functionError) {
        throw new Error(`Lambda function error: ${result.functionError}`);
      }

      return result;
    },

    invokeAsync: async (ctx: Context, input: InvokeAsyncInput) => {
      const validated = InvokeAsyncInputSchema.parse(input);

      await ctx.run(`invoke-async-${validated.functionName}`, retryConfig, async () => {
        const command = new InvokeCommand({
          FunctionName: validated.functionName,
          Payload: JSON.stringify(validated.payload),
          InvocationType: "Event", // Fire and forget
        });

        await lambdaClient.send(command);
      });

      ctx.console.info({
        service: "AWSLambdaService",
        action: "invokeAsync",
        functionName: validated.functionName,
      });

      return { invoked: true, functionName: validated.functionName };
    },

    getFunction: async (ctx: Context, input: GetFunctionInput) => {
      const validated = GetFunctionInputSchema.parse(input);

      const functionInfo = await ctx.run(`get-function-${validated.functionName}`, async () => {
        const command = new GetFunctionCommand({
          FunctionName: validated.functionName,
        });

        const response = await lambdaClient.send(command);

        return {
          functionName: response.Configuration?.FunctionName,
          functionArn: response.Configuration?.FunctionArn,
          runtime: response.Configuration?.Runtime,
          handler: response.Configuration?.Handler,
          memorySize: response.Configuration?.MemorySize,
          timeout: response.Configuration?.Timeout,
          lastModified: response.Configuration?.LastModified,
          codeSize: response.Configuration?.CodeSize,
          state: response.Configuration?.State,
          version: response.Configuration?.Version,
        };
      });

      return functionInfo;
    },

    listFunctions: async (ctx: Context, input?: { maxItems?: number }) => {
      const maxItems = input?.maxItems || 50;

      const functions = await ctx.run("list-functions", async () => {
        const command = new ListFunctionsCommand({
          MaxItems: maxItems,
        });

        const response = await lambdaClient.send(command);

        return (
          response.Functions?.map((fn) => ({
            functionName: fn.FunctionName,
            functionArn: fn.FunctionArn,
            runtime: fn.Runtime,
            handler: fn.Handler,
            memorySize: fn.MemorySize,
            timeout: fn.Timeout,
            lastModified: fn.LastModified,
          })) || []
        );
      });

      ctx.console.info({
        service: "AWSLambdaService",
        action: "listFunctions",
        count: functions.length,
      });

      return { functions, count: functions.length };
    },

    invokeFunctionWithRetry: async (
      ctx: Context,
      input: InvokeFunctionInput & { customRetryConfig?: any }
    ) => {
      const validated = InvokeFunctionInputSchema.parse(input);
      const retryConf = input.customRetryConfig || retryConfig;

      const result = await ctx.run(
        `invoke-with-retry-${validated.functionName}`,
        retryConf,
        async () => {
          const command = new InvokeCommand({
            FunctionName: validated.functionName,
            Payload: JSON.stringify(validated.payload),
            InvocationType: "RequestResponse",
          });

          const response = await lambdaClient.send(command);

          if (response.FunctionError) {
            throw new Error(`Lambda error: ${response.FunctionError}`);
          }

          const payload = response.Payload
            ? JSON.parse(new TextDecoder().decode(response.Payload))
            : null;

          return { statusCode: response.StatusCode, payload };
        }
      );

      return result;
    },

    health: async (ctx: Context) => {
      try {
        await ctx.run("health-check", async () => {
          const command = new ListFunctionsCommand({ MaxItems: 1 });
          await lambdaClient.send(command);
        });
        return { status: "healthy", region: config.region };
      } catch (error: any) {
        ctx.console.error("AWSLambdaService health check failed", error);
        return { status: "unhealthy", region: config.region };
      }
    },
  },
});
