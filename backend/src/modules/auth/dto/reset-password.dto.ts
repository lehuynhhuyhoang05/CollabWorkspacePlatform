import { IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'Token không hợp lệ' })
  @Length(24, 256, { message: 'Token không hợp lệ' })
  token: string;

  @IsString({ message: 'Mật khẩu là bắt buộc' })
  @Length(8, 128, { message: 'Mật khẩu cần từ 8 đến 128 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu cần có chữ hoa, chữ thường và chữ số',
  })
  newPassword: string;
}
