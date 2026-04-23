import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PromptVersion = `v${number}`;

@Injectable()
export class PromptLoader {
  private readonly logger = new Logger(PromptLoader.name);
  private readonly promptRoot = join(process.cwd(), 'prompts');
  private readonly cache = new Map<string, string>();
  private readonly versions: PromptVersion[];

  constructor() {
    this.versions = existsSync(this.promptRoot)
      ? (readdirSync(this.promptRoot)
          .filter((entry) => /^v\d+$/.test(entry))
          .sort() as PromptVersion[])
      : ['v1'];
    this.primeCache();
    this.logger.log(`Loaded prompt versions: ${this.versions.join(', ')}`);
  }

  load(templateName: string, version?: PromptVersion): string {
    const resolvedVersion = version ?? this.latestVersion();
    const key = `${resolvedVersion}/${templateName}`;
    const template = this.cache.get(key);
    if (!template) {
      throw new Error(`Prompt template not found: ${key}`);
    }
    return template;
  }

  render(
    templateName: string,
    variables: Record<string, string>,
    version?: PromptVersion
  ): string {
    return Object.entries(variables).reduce((content, [key, value]) => {
      return content.replaceAll(`{{${key}}}`, value);
    }, this.load(templateName, version));
  }

  latestVersion(): PromptVersion {
    return this.versions[this.versions.length - 1] ?? 'v1';
  }

  private primeCache(): void {
    for (const version of this.versions) {
      const versionPath = join(this.promptRoot, version);
      for (const file of readdirSync(versionPath).filter((entry) => entry.endsWith('.txt'))) {
        const key = `${version}/${file}`;
        this.cache.set(key, readFileSync(join(versionPath, file), 'utf8'));
      }
    }
  }
}
