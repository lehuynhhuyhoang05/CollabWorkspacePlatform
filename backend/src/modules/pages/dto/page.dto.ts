import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;
}

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;
}

export class MovePageDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  parentId?: string | null; // null = move to root
}
