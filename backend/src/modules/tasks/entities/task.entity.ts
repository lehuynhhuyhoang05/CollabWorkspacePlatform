import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { Page } from '../../pages/entities/page.entity';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'inProgress',
  DONE = 'done',
  BLOCKED = 'blocked',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('tasks')
export class Task {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: TaskStatus.TODO,
  })
  status!: TaskStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: TaskPriority.MEDIUM,
  })
  priority!: TaskPriority;

  @Column({ type: 'timestamp', name: 'due_date', nullable: true })
  dueDate!: Date | null;

  @Column({ type: 'varchar', length: 36, name: 'assignee_id', nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'varchar', length: 36, name: 'parent_task_id', nullable: true })
  parentTaskId!: string | null;

  @Column({ type: 'varchar', length: 36, name: 'related_page_id', nullable: true })
  relatedPageId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'google_event_id', nullable: true })
  googleEventId!: string | null;

  @Column({ type: 'varchar', length: 120, name: 'google_calendar_id', nullable: true })
  googleCalendarId!: string | null;

  @Column({ type: 'varchar', length: 500, name: 'google_meet_url', nullable: true })
  googleMeetUrl!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'google_event_etag', nullable: true })
  googleEventEtag!: string | null;

  @Column({ type: 'timestamp', name: 'google_event_updated_at', nullable: true })
  googleEventUpdatedAt!: Date | null;

  @Column({ type: 'timestamp', name: 'google_task_last_synced_at', nullable: true })
  googleTaskLastSyncedAt!: Date | null;

  @Column({ type: 'timestamp', name: 'google_last_pulled_at', nullable: true })
  googleLastPulledAt!: Date | null;

  @Column({ type: 'timestamp', name: 'google_sync_conflict_at', nullable: true })
  googleSyncConflictAt!: Date | null;

  @Column({ type: 'text', name: 'google_sync_conflict_message', nullable: true })
  googleSyncConflictMessage!: string | null;

  @Column({ type: 'varchar', length: 36, name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee!: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator!: User;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_task_id' })
  parentTask!: Task | null;

  @OneToMany(() => Task, (task) => task.parentTask)
  childTasks!: Task[];

  @ManyToOne(() => Page, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_page_id' })
  relatedPage!: Page | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  rollup?: {
    subtaskTotal: number;
    subtaskDone: number;
    progress: number;
  };

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
