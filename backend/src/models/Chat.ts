import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import {User} from './User';

/**
 * 채팅방 엔티티
 */
@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  room_id: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @Column({type: 'timestamptz', nullable: true})
  last_message_at?: Date;

  // 관계 설정
  @OneToMany(() => ChatParticipant, (participant) => participant.room)
  participants: ChatParticipant[];

  @OneToMany(() => ChatMessage, (message) => message.room)
  messages: ChatMessage[];
}

/**
 * 채팅방 참여자 엔티티
 */
@Entity('chat_participants')
export class ChatParticipant {
  @PrimaryColumn({type: 'uuid'})
  user_id: string;

  @PrimaryColumn({type: 'uuid'})
  room_id: string;

  @CreateDateColumn({type: 'timestamptz'})
  joined_at: Date;

  // 관계 설정
  @ManyToOne(() => User, (user) => user.user_id)
  @JoinColumn({name: 'user_id'})
  user: User;

  @ManyToOne(() => ChatRoom, (room) => room.participants)
  @JoinColumn({name: 'room_id'})
  room: ChatRoom;
}

/**
 * 채팅 메시지 엔티티
 */
@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  message_id: string;

  @Column({type: 'uuid'})
  room_id: string;

  @Column({type: 'uuid'})
  sender_id: string;

  @Column({type: 'smallint', default: 0})
  content_type: number; // 0: text, 1: image, etc.

  @Column({type: 'text'})
  content: string;

  @Column({type: 'boolean', default: false})
  read: boolean;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정
  @ManyToOne(() => ChatRoom, (room) => room.messages)
  @JoinColumn({name: 'room_id'})
  room: ChatRoom;

  @ManyToOne(() => User, (user) => user.user_id)
  @JoinColumn({name: 'sender_id'})
  sender: User;
}
