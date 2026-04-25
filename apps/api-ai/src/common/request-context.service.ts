import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthenticatedUser } from './contracts';

interface RequestContextState {
  user?: AuthenticatedUser;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextState>();

  run<T>(state: RequestContextState, callback: () => T): T {
    return this.storage.run(state, callback);
  }

  getUser(): AuthenticatedUser | undefined {
    return this.storage.getStore()?.user;
  }
}
