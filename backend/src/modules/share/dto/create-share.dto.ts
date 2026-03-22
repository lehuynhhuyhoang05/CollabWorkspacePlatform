import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum SharePermission {
  VIEW = 'view',
  EDIT = 'edit',
}

export class CreateShareDto {
  @ApiPropertyOptional({
    enum: SharePermission,
    description: 'Share permission',
    default: SharePermission.VIEW,
  })
  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;
}
