import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
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

  /**
   * Get current user profile (without sensitive fields).
   */
  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    const { password: _, refreshTokenHash: __, ...safeUser } = user;
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
}
