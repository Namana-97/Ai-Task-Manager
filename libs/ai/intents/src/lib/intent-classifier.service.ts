import { Inject, Injectable } from '@nestjs/common';
import { FunctionDeclaration, GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { OutputValidator } from '@ai-task-manager/ai/guardrails';
import { PromptLoader } from '@ai-task-manager/ai/rag';
import { ClassifiedIntent, TaskMutationParams } from './models';

const intentSchema = z.object({
  type: z.enum(['query', 'create_task', 'update_task', 'delete_task', 'status_report', 'unknown']),
  confidence: z.number().min(0).max(1),
  parameters: z
    .object({
      taskId: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      priority: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
      assignee: z.string().optional(),
      status: z.string().optional(),
      dueDate: z.string().optional(),
      tags: z.array(z.string()).optional(),
      recurrence: z.string().optional()
    })
    .optional(),
  requiresConfirmation: z.boolean()
});

@Injectable()
export class AnthropicIntentClassifier {
  private readonly provider = process.env.LLM_PROVIDER ?? 'gemini';
  private readonly model = this.resolveModel(
    process.env.LLM_MODEL ?? (this.provider === 'gemini' ? 'gemini-2.5-flash' : 'claude-sonnet-4-20250514')
  );
  private readonly anthropic = process.env.LLM_API_KEY
    ? new Anthropic({ apiKey: process.env.LLM_API_KEY })
    : null;

  constructor(
    @Inject(PromptLoader)
    private readonly promptLoader: PromptLoader,
    @Inject(OutputValidator)
    private readonly outputValidator: OutputValidator
  ) {}

  async classify(message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<ClassifiedIntent> {
    if (this.provider === 'gemini') {
      return this.classifyWithGemini(message, conversationHistory);
    }

    if (!this.anthropic) {
      return this.heuristicFallback(message);
    }

    const systemPrompt = this.promptLoader.load('intent-classifier.txt');
    const response = await this.anthropic.messages.create({
      model: this.model,
      system: systemPrompt,
      max_tokens: 512,
      tools: [
        {
          name: 'create_task',
          description: 'Create a task',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              priority: { type: 'string' },
              assignee: { type: 'string' },
              dueDate: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } }
            },
            required: ['title']
          }
        },
        {
          name: 'update_task',
          description: 'Update a task',
          input_schema: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              fields: { type: 'object' }
            },
            required: ['taskId', 'fields']
          }
        },
        {
          name: 'delete_task',
          description: 'Delete a task',
          input_schema: {
            type: 'object',
            properties: {
              taskId: { type: 'string' }
            },
            required: ['taskId']
          }
        },
        {
          name: 'status_report',
          description: 'Generate a status report',
          input_schema: {
            type: 'object',
            properties: {
              scope: { type: 'string' },
              timeRange: { type: 'string' }
            },
            required: ['scope', 'timeRange']
          }
        }
      ],
      messages: [
        ...conversationHistory.map((entry) => ({ role: entry.role, content: entry.content })),
        { role: 'user', content: message }
      ]
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return {
        type: 'query',
        confidence: 0.7,
        requiresConfirmation: false
      };
    }

    const parameters = this.extractParameters(toolUse.name, toolUse.input as Record<string, unknown>);
    return this.outputValidator.validate(intentSchema, {
      type: toolUse.name,
      confidence: 0.92,
      parameters,
      requiresConfirmation:
        toolUse.name === 'delete_task' ||
        (toolUse.name === 'update_task' &&
          (Boolean(parameters?.assignee) || Boolean(parameters?.status)))
    });
  }

  private async classifyWithGemini(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<ClassifiedIntent> {
    const apiKey = process.env.LLM_API_KEY ?? '';
    if (!apiKey) {
      return this.heuristicFallback(message);
    }

    const systemPrompt = `${this.promptLoader.load('intent-classifier.txt')}

Use the provided tools when the user wants to create, update, delete, or report on tasks.
For questions about tasks, do not call a tool and classify the request as a query.
Consider conversation history when resolving references like "that task" or "the login bug".`;

    const tools: FunctionDeclaration[] = [
      {
        name: 'create_task',
        description: 'Create a new task when the user asks to add, create, or set up a task.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: 'Short task title' },
            description: { type: SchemaType.STRING, description: 'Task description' },
            category: { type: SchemaType.STRING, description: 'Category such as Work or Engineering' },
            priority: {
              type: SchemaType.STRING,
              enum: ['Critical', 'High', 'Medium', 'Low']
            },
            assignee: { type: SchemaType.STRING, description: 'Name or user ID' },
            dueDate: { type: SchemaType.STRING, description: 'ISO 8601 date' },
            tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
          },
          required: ['title']
        }
      },
      {
        name: 'update_task',
        description: 'Update an existing task when the user asks to change, modify, or edit it.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING, description: 'The task ID to update' },
            fields: { type: SchemaType.OBJECT, description: 'Fields to update' }
          },
          required: ['taskId', 'fields']
        }
      },
      {
        name: 'delete_task',
        description: 'Delete a task only when the user explicitly wants to delete it.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING, description: 'The task ID to delete' }
          },
          required: ['taskId']
        }
      },
      {
        name: 'status_report',
        description: 'Generate a standup or status report when the user asks for a report.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            scope: { type: SchemaType.STRING, description: 'The report scope' },
            timeRange: { type: SchemaType.STRING, description: 'The report time range' }
          },
          required: ['scope', 'timeRange']
        }
      }
    ];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: this.model,
      tools: [{ functionDeclarations: tools }],
      systemInstruction: systemPrompt
    });

    const chat = model.startChat({
      history: history.map((entry) => ({
        role: entry.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: entry.content }]
      }))
    });
    const result = await chat.sendMessage(message);
    const response = result.response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ functionCall?: { name?: string; args?: Record<string, unknown> } }>;
        };
      }>;
    };

    const functionCall = response.candidates?.[0]?.content?.parts?.find((part) => part.functionCall)?.functionCall;
    if (!functionCall?.name) {
      return {
        type: 'query',
        confidence: 0.9,
        requiresConfirmation: false
      };
    }

    const toolName = functionCall.name;
    const parameters = this.extractParameters(toolName, functionCall.args ?? {});
    return this.outputValidator.validate(intentSchema, {
      type: toolName,
      confidence: 0.92,
      parameters,
      requiresConfirmation:
        toolName === 'delete_task' ||
        (toolName === 'update_task' &&
          (Boolean(parameters?.assignee) || Boolean(parameters?.status)))
    });
  }

  private heuristicFallback(message: string): ClassifiedIntent {
    const normalized = message.toLowerCase();
    if (normalized.includes('delete')) {
      return {
        type: 'delete_task',
        confidence: 0.65,
        parameters: { taskId: this.extractTaskId(message) },
        requiresConfirmation: true
      };
    }
    if (normalized.includes('create') || normalized.includes('add task')) {
      return {
        type: 'create_task',
        confidence: 0.6,
        parameters: { title: message.replace(/create task|add task/gi, '').trim() },
        requiresConfirmation: false
      };
    }
    if (normalized.includes('update')) {
      return {
        type: 'update_task',
        confidence: 0.6,
        parameters: { taskId: this.extractTaskId(message) },
        requiresConfirmation: false
      };
    }
    if (normalized.includes('report') || normalized.includes('standup')) {
      return {
        type: 'status_report',
        confidence: 0.7,
        requiresConfirmation: false
      };
    }
    return {
      type: 'query',
      confidence: 0.7,
      requiresConfirmation: false
    };
  }

  private extractParameters(toolName: string, input: Record<string, unknown>): TaskMutationParams {
    if (toolName === 'update_task') {
      return {
        taskId: String(input.taskId),
        ...(input.fields as TaskMutationParams)
      };
    }
    return input as TaskMutationParams;
  }

  private extractTaskId(message: string): string | undefined {
    return message.match(/task[-\s]?(\d+)/i)?.[0]?.replace(/\s+/g, '-').toLowerCase();
  }

  private resolveModel(model: string): string {
    if (
      this.provider === 'gemini' &&
      ['gemini-1.5-flash', 'gemini-1.5-flash-latest'].includes(model)
    ) {
      return 'gemini-2.5-flash';
    }
    return model;
  }
}
