import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  MENTION = 'mention',
  TASK_ASSIGNED = 'taskAssigned',
  DEADLINE_REMINDER = 'deadlineReminder',
  TASK_BLOCKED = 'taskBlocked',
  TASK_COMPLETED = 'taskCompleted',
  TASK_OVERDUE = 'taskOverdue',
  WORKSPACE_INVITATION = 'workspaceInvitation',
  WORKSPACE_INVITATION_RESPONSE = 'workspaceInvitationResponse',
  DIRECT_MESSAGE = 'directMessage',
}

@Entity('notifications')
export class Notification {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'workspace_id', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 500, name: 'link_url', nullable: true })
  linkUrl: string | null;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', name: 'read_at', nullable: true })
  readAt: Date | null;

  @Column({ type: 'varchar', length: 36, name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 40, name: 'entity_type', nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', length: 36, name: 'entity_id', nullable: true })
  entityId: string | null;

  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
