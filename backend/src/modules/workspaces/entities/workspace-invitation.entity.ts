import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Workspace } from './workspace.entity';
import { User } from '../../users/entities/user.entity';
import { WorkspaceRole } from './workspace-member.entity';

export enum WorkspaceInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REFUSED = 'refused',
  CANCELED = 'canceled',
}

@Entity('workspace_invitations')
export class WorkspaceInvitation {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'workspace_id' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 36, name: 'inviter_id' })
  inviterId: string;

  @Column({ type: 'varchar', length: 36, name: 'invitee_id' })
  inviteeId: string;

  @Column({ type: 'varchar', length: 20, default: WorkspaceRole.EDITOR })
  role: WorkspaceRole;

  @Column({
    type: 'varchar',
    length: 20,
    default: WorkspaceInvitationStatus.PENDING,
  })
  status: WorkspaceInvitationStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'timestamp', name: 'responded_at', nullable: true })
  respondedAt: Date | null;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inviter_id' })
  inviter: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitee_id' })
  invitee: User;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
