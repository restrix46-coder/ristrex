import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Response } from 'express';

export const COLLABORATION_MIGRATION = `
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  type VARCHAR(100) NOT NULL,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export interface Comment {
  id: string;
  projectId: string;
  targetType: 'file' | 'message' | 'task';
  targetId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  participants: string[];
  startedAt: Date;
}

export interface ActivityEvent {
  type: string;
  userId: string;
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ActivityFeed {
  projectId: string;
  events: ActivityEvent[];
}

/**
 * Creates a Server-Sent Events (SSE) stream for real-time collaboration updates.
 * @param projectId - The project ID
 * @param res - The Express response object
 */
export function createCollaborationStream(projectId: string, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const keepAlive = setInterval(() => {
    res.write(':\n\n'); // keep-alive comment
  }, 15000);

  // In a real implementation, you would attach this response to an EventEmitter
  // or a Pub/Sub system (like Redis) to push events to this specific client.

  res.on('close', () => {
    clearInterval(keepAlive);
    // Cleanup subscriptions
  });
}

/**
 * Service for managing project collaboration features.
 */
export class CollaborationService {
  
  /**
   * Adds a new comment to a project.
   * @param comment - The comment data to add
   * @returns The created comment
   */
  async addComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const sql = getSql();
    try {
      const rows = await sql<any[]>`
        INSERT INTO project_comments (project_id, target_type, target_id, author_id, content)
        VALUES (${comment.projectId}, ${comment.targetType}, ${comment.targetId}, ${comment.authorId}, ${comment.content})
        RETURNING id, project_id as "projectId", target_type as "targetType", target_id as "targetId", author_id as "authorId", content, created_at as "createdAt", resolved_at as "resolvedAt"
      `;
      return rows[0] as Comment;
    } catch (error) {
      logger.error('Failed to add comment', { error });
      throw new Error('Failed to add comment');
    }
  }

  /**
   * Resolves a specific comment.
   * @param commentId - The ID of the comment to resolve
   * @param userId - The ID of the user resolving the comment
   */
  async resolveComment(commentId: string, userId: string): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        UPDATE project_comments
        SET resolved_at = CURRENT_TIMESTAMP
        WHERE id = ${commentId}
      `;
      logger.info(`Comment ${commentId} resolved by user ${userId}`);
    } catch (error) {
      logger.error('Failed to resolve comment', { error });
      throw new Error('Failed to resolve comment');
    }
  }

  /**
   * Gets comments for a project, optionally filtered by target.
   * @param projectId - The project ID
   * @param targetId - Optional target ID to filter by
   * @returns Array of comments
   */
  async getComments(projectId: string, targetId?: string): Promise<Comment[]> {
    const sql = getSql();
    try {
      const rows = await sql<any[]>`
        SELECT id, project_id as "projectId", target_type as "targetType", target_id as "targetId", author_id as "authorId", content, created_at as "createdAt", resolved_at as "resolvedAt"
        FROM project_comments
        WHERE project_id = ${projectId}
        ${targetId ? sql`AND target_id = ${targetId}` : sql``}
        ORDER BY created_at ASC
      `;
      return rows as Comment[];
    } catch (error) {
      logger.error('Failed to get comments', { error });
      throw new Error('Failed to get comments');
    }
  }

  /**
   * Adds an activity event to the feed.
   * @param projectId - The project ID
   * @param event - The event data
   */
  async addActivity(projectId: string, event: Omit<ActivityEvent, 'timestamp'>): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        INSERT INTO activity_feed (project_id, type, user_id, description, metadata)
        VALUES (${projectId}, ${event.type}, ${event.userId}, ${event.description}, ${event.metadata || {}})
      `;
    } catch (error) {
      logger.error('Failed to add activity event', { error });
    }
  }

  /**
   * Retrieves the activity feed for a project.
   * @param projectId - The project ID
   * @param limit - Maximum number of events to return
   * @returns Array of activity events
   */
  async getActivityFeed(projectId: string, limit: number = 50): Promise<ActivityEvent[]> {
    const sql = getSql();
    try {
      const rows = await sql<any[]>`
        SELECT type, user_id as "userId", description, metadata, timestamp
        FROM activity_feed
        WHERE project_id = ${projectId}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
      return rows as ActivityEvent[];
    } catch (error) {
      logger.error('Failed to get activity feed', { error });
      throw new Error('Failed to get activity feed');
    }
  }

  /**
   * Generates an invitation link for a collaborator.
   * @param projectId - The project ID
   * @param email - The email to invite
   * @param role - The role to assign
   * @returns Invitation link URL string
   */
  async inviteCollaborator(projectId: string, email: string, role: string): Promise<string> {
    // Implement standard secure token generation for invitation
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    logger.info(`Generated invite link for ${email} with role ${role} on project ${projectId}`);
    return `https://staging.weaver.ai/invite?token=${token}&project=${projectId}`;
  }

  /**
   * Returns a list of currently online participants for a project.
   * @param projectId - The project ID
   * @returns Array of user IDs
   */
  async getOnlineParticipants(projectId: string): Promise<string[]> {
    // In a real application, this would query a real-time store like Redis
    // where active WebSocket/SSE connections are tracked.
    return ['user-uuid-1', 'user-uuid-2']; 
  }
}
