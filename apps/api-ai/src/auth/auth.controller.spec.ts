import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STUB = 'false';
    process.env.JWT_SECRET = 'test-secret';
    process.env.SEED_VECTOR_STORE = 'false';
  });

  it('authenticates a seeded user and returns a JWT', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const controller = moduleRef.get(AuthController);
    const result = await controller.login({
      username: 'jordan',
      password: 'jordan123'
    });

    expect(result.token).toEqual(expect.any(String));
    expect(result.user).toEqual(
      expect.objectContaining({
        username: 'jordan',
        role: 'admin'
      })
    );
  });

  it('rejects invalid credentials', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const controller = moduleRef.get(AuthController);
    await expect(
      controller.login({
        username: 'jordan',
        password: 'wrong-password'
      })
    ).rejects.toMatchObject({
      status: 401
    });
  });
});
