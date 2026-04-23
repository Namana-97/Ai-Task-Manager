import { Inject, Injectable } from '@nestjs/common';
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
  private readonly model = 'claude-sonnet-4-20250514';
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
    if (!this.anthropic) {
      return this.heuristicClassify(message);
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

  private heuristicClassify(message: string): ClassifiedIntent {
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
}
