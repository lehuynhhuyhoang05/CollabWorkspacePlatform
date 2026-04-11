import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type CollaborationBlockEventType =
  | 'block-created'
  | 'block-updated'
  | 'block-deleted'
  | 'block-reordered';

export interface CollaborationBlockEvent {
  pageId: string;
  type: CollaborationBlockEventType;
  payload: Record<string, unknown>;
}

@Injectable()
export class CollaborationEventsService {
  private readonly blockEventsSubject = new Subject<CollaborationBlockEvent>();

  get blockEvents$(): Observable<CollaborationBlockEvent> {
    return this.blockEventsSubject.asObservable();
  }

  emitBlockEvent(event: CollaborationBlockEvent): void {
    this.blockEventsSubject.next(event);
  }
}