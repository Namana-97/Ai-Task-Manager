import { Inject, Injectable } from '@nestjs/common';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { OutputValidator } from '@ai-task-manager/ai/guardrails';
import { GeminiKeyPool, PromptLoader } from '@ai-task-manager/ai/rag';
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
    process.env.LLM_MODEL ??
      (this.provider === 'gemini'
        ? 'gemini-2.5-flash'
        : this.provider === 'openai'
          ? 'gpt-4o-mini'
          : 'claude-sonnet-4-20250514')
  );
  private readonly anthropic = process.env.LLM_API_KEY
    ? new Anthropic({ apiKey: process.env.LLM_API_KEY })
    : null;
  private readonly openai = process.env.LLM_API_KEY
    ? new OpenAI({ apiKey: process.env.LLM_API_KEY })
    : null;

  constructor(
    @Inject(PromptLoader)
    private readonly promptLoader: PromptLoader,
    @Inject(OutputValidator)
    private readonly outputValidator: OutputValidator,
    @Inject(GeminiKeyPool)
    private readonly geminiKeyPool: GeminiKeyPool
  ) {}

  async classify(message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<ClassifiedIntent> {
    const directIntent = this.ruleBasedIntent(message);
    if (directIntent) {
      return directIntent;
    }

    if (this.provider === 'gemini') {
      return this.classifyWithGemini(message, conversationHistory);
    }

    if (this.provider === 'openai') {
      return this.classifyWithOpenAi(message, conversationHistory);
    }

    if (this.provider !== 'anthropic') {
      return this.heuristicFallback(message);
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
    if (!this.geminiKeyPool.hasKeys()) {
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
            tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            recurrence: {
              type: SchemaType.STRING,
              description: 'Optional recurrence rule such as weekly/friday/15:00'
            }
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

    const result = await this.geminiKeyPool.withClient(async (client) => {
      const model = client.getGenerativeModel({
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

      return chat.sendMessage(message);
    });
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

  private async classifyWithOpenAi(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<ClassifiedIntent> {
    if (!this.openai) {
      return this.heuristicFallback(message);
    }

    const systemPrompt = `${this.promptLoader.load('intent-classifier.txt')}

Use the provided tools when the user wants to create, update, delete, or report on tasks.
For questions about tasks, do not call a tool and classify the request as a query.
Consider conversation history when resolving references like "that task" or "the login bug".`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map((entry) => ({ role: entry.role, content: entry.content })),
        { role: 'user', content: message }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_task',
            description: 'Create a new task when the user asks to add, create, or set up a task.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Short task title' },
                description: { type: 'string', description: 'Task description' },
                category: { type: 'string', description: 'Category such as Work or Engineering' },
                priority: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
                assignee: { type: 'string', description: 'Name or user ID' },
                dueDate: { type: 'string', description: 'ISO 8601 date' },
                tags: { type: 'array', items: { type: 'string' } },
                recurrence: {
                  type: 'string',
                  description: 'Optional recurrence rule such as weekly/friday/15:00'
                }
              },
              required: ['title']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'update_task',
            description: 'Update an existing task when the user asks to change, modify, or edit it.',
            parameters: {
              type: 'object',
              properties: {
                taskId: { type: 'string', description: 'The task ID to update' },
                fields: { type: 'object', description: 'Fields to update' }
              },
              required: ['taskId', 'fields']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'delete_task',
            description: 'Delete a task only when the user explicitly wants to delete it.',
            parameters: {
              type: 'object',
              properties: {
                taskId: { type: 'string', description: 'The task ID to delete' }
              },
              required: ['taskId']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'status_report',
            description: 'Generate a standup or status report when the user asks for a report.',
            parameters: {
              type: 'object',
              properties: {
                scope: { type: 'string', description: 'The report scope' },
                timeRange: { type: 'string', description: 'The report time range' }
              },
              required: ['scope', 'timeRange']
            }
          }
        }
      ]
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      return {
        type: 'query',
        confidence: 0.9,
        requiresConfirmation: false
      };
    }

    const rawArgs = toolCall.function.arguments?.trim();
    const parsedArgs =
      rawArgs && rawArgs.length > 0 ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
    const parameters = this.extractParameters(toolCall.function.name, parsedArgs);
    return this.outputValidator.validate(intentSchema, {
      type: toolCall.function.name,
      confidence: 0.92,
      parameters,
      requiresConfirmation:
        toolCall.function.name === 'delete_task' ||
        (toolCall.function.name === 'update_task' &&
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

  private ruleBasedIntent(message: string): ClassifiedIntent | null {
    const statusUpdate = this.extractStatusUpdate(message);
    if (statusUpdate) {
      return {
        type: 'update_task',
        confidence: 0.96,
        parameters: statusUpdate,
        requiresConfirmation: true
      };
    }

    if (this.isReadOnlyTaskQuery(message)) {
      return {
        type: 'query',
        confidence: 0.97,
        requiresConfirmation: false
      };
    }

    return null;
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

  private extractStatusUpdate(message: string): TaskMutationParams | null {
    const patterns = [
      /(?:change|update|set)\s+(?:the\s+)?status\s+(?:of\s+(?:the\s+)?)?(task[-\s]?\d+)\s+(?:to|as)\s+([a-z ]+)/i,
      /(?:mark|set)\s+(task[-\s]?\d+)\s+(?:to|as)\s+([a-z ]+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (!match) {
        continue;
      }

      const taskId = match[1]?.replace(/\s+/g, '-').toLowerCase();
      const status = normalizeStatus(match[2] ?? '');
      if (taskId && status) {
        return {
          taskId,
          status
        };
      }
    }

    return null;
  }

  private isReadOnlyTaskQuery(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return (
      /\bwhat did i finish last week\b/.test(normalized) ||
      /\b(show|list)\s+(all\s+)?(the\s+)?tasks\b/.test(normalized) ||
      /\b(overdue|past due)\b/.test(normalized) ||
      /\b(in progress|currently in progress|tasks in progress|tasks are in progress|tasks which are in progress)\b/.test(
        normalized
      ) ||
      /\b(pending|open tasks|tasks are pending|to do)\b/.test(normalized) ||
      /\b(blocked tasks|tasks are blocked|which are blocked|show blocked tasks|list all blocked tasks)\b/.test(
        normalized
      ) ||
      /\b(completed recently|finished recently|completed lately|recently completed)\b/.test(normalized) ||
      /\b(all(?:\s+the)?\s+completed tasks|completed tasks|done tasks|tasks are done|tasks are completed|tasks which are done|tasks which are completed|what tasks are done|what tasks are completed|show the tasks in done)\b/.test(
        normalized
      )
    );
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

function normalizeStatus(value: string): string | undefined {
  const normalized = value.trim().toLowerCase().replace(/[?.!]+$/g, '');
  if (normalized === 'blocked') {
    return 'Blocked';
  }
  if (normalized === 'done' || normalized === 'completed' || normalized === 'complete') {
    return 'Done';
  }
  if (normalized === 'in progress' || normalized === 'in-progress') {
    return 'In Progress';
  }
  if (normalized === 'open' || normalized === 'pending') {
    return 'Open';
  }
  if (normalized === 'to do' || normalized === 'todo') {
    return 'To Do';
  }

  return undefined;
}
