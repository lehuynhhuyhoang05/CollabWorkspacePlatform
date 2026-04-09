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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('workspaces/:wid/tasks')
  @ApiOperation({ summary: 'Danh sách tasks của workspace' })
  findAllForWorkspace(
    @Param('wid') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.findAllForWorkspace(workspaceId, userId);
  }

  @Get('tasks/my')
  @ApiOperation({ summary: 'Danh sách tasks được giao cho tôi' })
  findMyTasks(@CurrentUser('id') userId: string) {
    return this.tasksService.findMyTasks(userId);
  }

  @Post('workspaces/:wid/tasks')
  @ApiOperation({ summary: 'Tạo task mới' })
  create(
    @Param('wid') workspaceId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.create(workspaceId, dto, userId);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Cập nhật task' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.update(id, dto, userId);
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: 'Xóa task' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.remove(id, userId);
  }
}
