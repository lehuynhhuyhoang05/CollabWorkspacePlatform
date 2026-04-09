import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExchangeGoogleCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;
}
