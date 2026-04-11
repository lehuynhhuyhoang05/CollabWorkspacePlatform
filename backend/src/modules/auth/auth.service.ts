import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

const BCRYPT_SALT_ROUNDS = 12;
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user account.
   * - Checks for duplicate email
   * - Hashes password with bcrypt (salt 12)
   * - Generates initial token pair
   * - Stores hashed refresh token in DB (refresh token rotation)
   */
  async register(dto: RegisterDto): Promise<TokenPair> {
    // Check duplicate email
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = await this.usersService.create({
      email: dto.email.toLowerCase().trim(),
      name: dto.name.trim(),
      password: hashedPassword,
    });

    // Generate tokens & store refresh token hash
    const tokens = await this.generateTokenPair(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User registered: ${user.email}`);
    return tokens;
  }

  /**
   * Login with email + password.
   * - Validates credentials
   * - Generates new token pair
   * - Rotates refresh token (old one invalidated)
   */
  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(
      dto.email.toLowerCase().trim(),
    );
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Generate tokens & rotate refresh token
    const tokens = await this.generateTokenPair(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User logged in: ${user.email}`);
    return tokens;
  }

  /**
   * Refresh access token using a valid refresh token.
   * Implements Refresh Token Rotation:
   * - Validates the refresh token JWT
   * - Compares hash with stored hash (prevents reuse of old tokens)
   * - Issues new token pair
   * - Stores hash of new refresh token
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    // Compare with stored hash — prevents reuse of old refresh tokens
    const storedHash = await this.usersService.getRefreshTokenHash(payload.sub);
    if (!storedHash) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    const isValid = await bcrypt.compare(refreshToken, storedHash);
    if (!isValid) {
      // Potential token theft — invalidate all sessions for this user
      this.logger.warn(
        `Refresh token reuse detected for user ${payload.sub}. Invalidating all sessions.`,
      );
      await this.usersService.updateRefreshToken(payload.sub, null);
      throw new UnauthorizedException(
        'Refresh token đã được sử dụng. Vui lòng đăng nhập lại.',
      );
    }

    // Get fresh user data
    const user = await this.usersService.findById(payload.sub);

    // Rotate: issue new pair, store new hash
    const tokens = await this.generateTokenPair(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logout — invalidate refresh token.
   */
  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
    this.logger.log(`User logged out: ${userId}`);
  }

  async requestPasswordReset(email: string): Promise<{
    message: string;
    resetUrlPreview?: string;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    const genericResponse = {
      message:
        'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
    };

    if (!user) {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.buildResetTokenHash(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.usersService.setPasswordResetToken(
      user.id,
      tokenHash,
      expiresAt,
    );

    const frontendBaseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const primaryFrontendUrl =
      frontendBaseUrl.split(',')[0]?.trim() || frontendBaseUrl;
    const resetUrl = `${primaryFrontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

    this.logger.log(
      `Password reset requested for ${normalizedEmail}. Reset URL: ${resetUrl}`,
    );

    if (process.env.NODE_ENV !== 'production') {
      return {
        ...genericResponse,
        resetUrlPreview: resetUrl,
      };
    }

    return genericResponse;
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ');
    }

    const tokenHash = this.buildResetTokenHash(normalizedToken);
    const user =
      await this.usersService.findByPasswordResetTokenHash(tokenHash);

    if (!user) {
      throw new BadRequestException(
        'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.usersService.clearPasswordResetToken(user.id);
    await this.usersService.updateRefreshToken(user.id, null);

    this.logger.log(`Password reset completed for user: ${user.id}`);
    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  /**
   * Get current user profile (without sensitive fields).
   */
  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    const safeUser = {
      ...user,
    } as Partial<User>;

    delete safeUser.password;
    delete safeUser.refreshTokenHash;
    delete safeUser.passwordResetTokenHash;
    delete safeUser.passwordResetExpiresAt;

    return safeUser;
  }

  // ──── Private helpers ────

  private async generateTokenPair(user: User): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const tokenPayload = { ...payload };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
      }),
      this.jwtService.signAsync(tokenPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Store bcrypt hash of refresh token — never store the raw token.
   * This enables refresh token rotation detection.
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.usersService.updateRefreshToken(userId, hash);
  }

  private buildResetTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
