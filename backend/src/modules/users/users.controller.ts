import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy profile của mình' })
  async getProfile(@CurrentUser('id') userId: string) {
    const user = await this.usersService.findById(userId);
    const safeUser = { ...user } as Partial<typeof user>;
    delete safeUser.password;
    delete safeUser.refreshTokenHash;
    delete safeUser.passwordResetTokenHash;
    delete safeUser.passwordResetExpiresAt;
    return safeUser;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật profile (name, avatar)' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(userId, dto);
    const safeUser = { ...user } as Partial<typeof user>;
    delete safeUser.password;
    delete safeUser.refreshTokenHash;
    delete safeUser.passwordResetTokenHash;
    delete safeUser.passwordResetExpiresAt;
    return safeUser;
  }
}
