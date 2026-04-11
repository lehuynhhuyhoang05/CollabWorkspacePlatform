import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
  InviteMemberDto,
  RespondInvitationDto,
  UpdateMemberRoleDto,
} from './dto/member.dto';

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo workspace mới' })
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser('id') userId: string) {
    return this.workspacesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách workspace của tôi' })
  findAll(@CurrentUser('id') userId: string) {
    return this.workspacesService.findAllForUser(userId);
  }

  @Get('invitations/incoming')
  @ApiOperation({ summary: 'Danh sách lời mời workspace đang chờ phản hồi' })
  listIncomingInvitations(@CurrentUser('id') userId: string) {
    return this.workspacesService.listIncomingInvitations(userId);
  }

  @Patch('invitations/:invitationId/respond')
  @ApiOperation({ summary: 'Phản hồi lời mời workspace (accept/refuse)' })
  respondInvitation(
    @Param('invitationId') invitationId: string,
    @Body() dto: RespondInvitationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.respondInvitation(
      invitationId,
      userId,
      dto.action,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết workspace' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.workspacesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật workspace (name/icon)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.update(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá workspace (chỉ owner)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.workspacesService.remove(id, userId);
  }

  // ──── Members ────

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite member vào workspace bằng email' })
  invite(
    @Param('id') workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.inviteMember(
      workspaceId,
      dto.email,
      dto.role!,
      userId,
    );
  }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'Danh sách lời mời của workspace' })
  listWorkspaceInvitations(
    @Param('id') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.listWorkspaceInvitations(workspaceId, userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Danh sách members' })
  getMembers(
    @Param('id') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.getMembers(workspaceId, userId);
  }

  @Patch(':id/members/:uid')
  @ApiOperation({ summary: 'Thay đổi role member (chỉ owner)' })
  updateMemberRole(
    @Param('id') workspaceId: string,
    @Param('uid') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.updateMemberRole(
      workspaceId,
      targetUserId,
      dto.role,
      userId,
    );
  }

  @Delete(':id/members/:uid')
  @ApiOperation({ summary: 'Kick member / rời workspace' })
  removeMember(
    @Param('id') workspaceId: string,
    @Param('uid') targetUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.removeMember(
      workspaceId,
      targetUserId,
      userId,
    );
  }
}
