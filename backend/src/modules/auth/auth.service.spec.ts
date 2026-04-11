import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

type MockedUsersService = jest.Mocked<
  Pick<
    UsersService,
    | 'findByEmail'
    | 'findById'
    | 'create'
    | 'updateRefreshToken'
    | 'getRefreshTokenHash'
    | 'setPasswordResetToken'
    | 'findByPasswordResetTokenHash'
    | 'updatePassword'
    | 'clearPasswordResetToken'
  >
>;

type MockedJwtService = jest.Mocked<Pick<JwtService, 'signAsync' | 'verify'>>;
type MockedConfigService = jest.Mocked<Pick<ConfigService, 'get'>>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: MockedUsersService;
  let jwtService: MockedJwtService;
  let configService: MockedConfigService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn(),
      getRefreshTokenHash: jest.fn(),
      setPasswordResetToken: jest.fn(),
      findByPasswordResetTokenHash: jest.fn(),
      updatePassword: jest.fn(),
      clearPasswordResetToken: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          JWT_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return map[key];
      }),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('register should throw conflict when email already exists', async () => {
    usersService.findByEmail.mockResolvedValueOnce({ id: 'u1' } as any);

    await expect(
      service.register({
        email: 'existing@example.com',
        name: 'Test',
        password: 'StrongP@ssw0rd',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('register should create normalized user and store refresh hash', async () => {
    const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

    usersService.findByEmail.mockResolvedValueOnce(null);
    mockedBcrypt.hash
      .mockResolvedValueOnce('hashed-password')
      .mockResolvedValueOnce('hashed-refresh');
    usersService.create.mockResolvedValueOnce({
      id: 'u1',
      email: 'new@example.com',
      name: 'New User',
    } as any);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.register({
      email: '  NEW@Example.com ',
      name: ' New User ',
      password: 'StrongP@ssw0rd',
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        name: 'New User',
        password: 'hashed-password',
      }),
    );
    expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
      'u1',
      'hashed-refresh',
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('login should reject invalid password', async () => {
    const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

    usersService.findByEmail.mockResolvedValueOnce({
      id: 'u1',
      email: 'x@example.com',
      password: 'stored-hash',
      name: 'X',
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(false);

    await expect(
      service.login({ email: 'x@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refresh should revoke session on token reuse detection', async () => {
    const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

    jwtService.verify.mockReturnValueOnce({
      sub: 'u1',
      email: 'x@example.com',
      name: 'X',
    } as any);
    usersService.getRefreshTokenHash.mockResolvedValueOnce('stored-hash');
    mockedBcrypt.compare.mockResolvedValueOnce(false);

    await expect(service.refresh('stolen-refresh-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersService.updateRefreshToken).toHaveBeenCalledWith('u1', null);
  });

  it('getMe should remove sensitive fields', async () => {
    usersService.findById.mockResolvedValueOnce({
      id: 'u1',
      email: 'x@example.com',
      name: 'X',
      password: 'hash',
      refreshTokenHash: 'refresh-hash',
      passwordResetTokenHash: 'reset-hash',
      passwordResetExpiresAt: new Date('2026-04-10T00:00:00.000Z'),
    } as any);

    const me = await service.getMe('u1');

    expect(me).toEqual({
      id: 'u1',
      email: 'x@example.com',
      name: 'X',
    });
  });

  it('requestPasswordReset should return generic message for non-existing email', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);

    const result = await service.requestPasswordReset('unknown@example.com');

    expect(result.message).toContain('Nếu email tồn tại');
    expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
  });

  it('resetPassword should throw when token is invalid', async () => {
    usersService.findByPasswordResetTokenHash.mockResolvedValueOnce(null);

    await expect(
      service.resetPassword('invalid-token', 'StrongP@ssw0rd'),
    ).rejects.toThrow(BadRequestException);
  });

  it('resetPassword should update password and clear reset token', async () => {
    const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
    usersService.findByPasswordResetTokenHash.mockResolvedValueOnce({
      id: 'u1',
      email: 'x@example.com',
    } as any);
    mockedBcrypt.hash.mockResolvedValueOnce('new-password-hash');

    const result = await service.resetPassword('valid-token', 'StrongP@ssw0rd');

    expect(usersService.updatePassword).toHaveBeenCalledWith(
      'u1',
      'new-password-hash',
    );
    expect(usersService.clearPasswordResetToken).toHaveBeenCalledWith('u1');
    expect(usersService.updateRefreshToken).toHaveBeenCalledWith('u1', null);
    expect(result.message).toContain('Đặt lại mật khẩu thành công');
  });
});
