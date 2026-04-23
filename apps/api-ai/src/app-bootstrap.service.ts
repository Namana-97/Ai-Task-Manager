import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { TaskRepositoryStub } from './repository/task-repository.stub';

@Injectable()
export class AppBootstrapService implements OnModuleInit {
  constructor(@Optional() @Inject(TaskRepositoryStub) private readonly repository?: TaskRepositoryStub) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV !== 'production' && this.repository) {
      await this.repository.seedVectorStore();
    }
  }
}
