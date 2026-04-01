import {
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {User} from './User';
import {RecipePost} from './Post';

/**
 * 좋아요 엔티티
 */
@Entity('likes')
export class Like {
  @PrimaryColumn({type: 'uuid'})
  user_id: string;

  @PrimaryColumn({type: 'uuid'})
  recipe_post_id: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'likes')
  @JoinColumn({name: 'user_id'})
  user: any;

  @ManyToOne('RecipePost', 'likes')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;
}

/**
 * 댓글 엔티티
 */
@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  comment_id: string;

  @Column({type: 'uuid'})
  recipe_post_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'uuid', nullable: true})
  parent_comment_id?: string;

  @Column({type: 'text'})
  content: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  @Column({type: 'boolean', default: false})
  delete_yn: boolean;

  @Column({type: 'timestamptz', nullable: true})
  deleted_at?: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('RecipePost', 'comments')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;

  @ManyToOne('User', 'comments')
  @JoinColumn({name: 'user_id'})
  user: any;

  @ManyToOne('Comment', 'comment_id')
  @JoinColumn({name: 'parent_comment_id'})
  parentComment: any;
}

/**
 * 알림 엔티티
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  notification_id: string;

  @Column({type: 'uuid'})
  recipient_id: string;

  @Column({type: 'uuid'})
  actor_id: string;

  @Column({type: 'varchar', length: 50})
  action_type: string;

  @Column({type: 'uuid', nullable: true})
  target_id?: string;

  @Column({type: 'boolean', default: false})
  is_read: boolean;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'receivedNotifications')
  @JoinColumn({name: 'recipient_id'})
  recipient: any;

  @ManyToOne('User', 'sentNotifications')
  @JoinColumn({name: 'actor_id'})
  actor: any;
}

/**
 * 푸시 알림 엔티티
 */
@Entity('push')
export class Push {
  @PrimaryGeneratedColumn('uuid')
  push_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'varchar', length: 255, nullable: true})
  title?: string;

  @Column({type: 'smallint', nullable: true})
  push_type?: number;

  @Column({type: 'varchar', length: 255, nullable: true})
  content?: string;

  @Column({type: 'boolean', default: false})
  read: boolean;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'pushNotifications')
  @JoinColumn({name: 'user_id'})
  user: any;
}
