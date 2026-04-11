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
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { GoogleCalendarSyncJob } from './google-calendar-sync-job.entity';

@Entity('google_integration_audit_logs')
export class GoogleIntegrationAuditLog {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 36, name: 'workspace_id', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', length: 36, name: 'job_id', nullable: true })
  jobId: string | null;

  @Column({ type: 'varchar', length: 30, default: 'google' })
  provider: string;

  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', name: 'request_payload', nullable: true })
  requestPayload: string | null;

  @Column({ type: 'text', name: 'response_payload', nullable: true })
  responsePayload: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  @ManyToOne(() => GoogleCalendarSyncJob, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'job_id' })
  job: GoogleCalendarSyncJob | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
