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
import type {Point} from 'geojson';
import {User} from './User';

/**
 * 상황 카테고리 엔티티
 */
@Entity('situations')
export class Situation {
  @PrimaryGeneratedColumn()
  situation_id: number;

  @Column({type: 'varchar', length: 50, unique: true})
  name: string;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @OneToMany('RecipeRelation', 'situation')
  recipeRelations: any[];
}

/**
 * 조리법 카테고리 엔티티
 */
@Entity('cooking_methods')
export class CookingMethod {
  @PrimaryGeneratedColumn()
  method_id: number;

  @Column({type: 'varchar', length: 50, unique: true})
  name: string;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @OneToMany('RecipeRelation', 'cookingMethod')
  recipeRelations: any[];
}

/**
 * 주재료 엔티티
 */
@Entity('main_ingredient')
export class MainIngredient {
  @PrimaryGeneratedColumn()
  main_ingredient_id: number;

  @Column({type: 'int'})
  ingredient_id: number;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('Ingredient', 'mainIngredients')
  @JoinColumn({name: 'ingredient_id'})
  ingredient: any;

  @OneToMany('RecipeRelation', 'mainIngredient')
  recipeRelations: any[];
}

/**
 * 재료 하위 카테고리 엔티티
 */
@Entity('ingredient_sub_categories')
export class IngredientSubCategory {
  @PrimaryGeneratedColumn()
  category_id: number;

  @Column({type: 'varchar', length: 50, unique: true})
  name: string;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @OneToMany('Ingredient', 'subCategory')
  ingredients: any[];
}

/**
 * 재료 엔티티
 */
@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn()
  ingredient_id: number;

  @Column({type: 'varchar', length: 100})
  name: string;

  @Column({type: 'int', nullable: true})
  sub_category_id?: number;

  @Column({type: 'uuid', nullable: true})
  user_id?: string;

  @Column({type: 'varchar', length: 20, nullable: true})
  default_unit?: string;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('IngredientSubCategory', 'subCategory')
  @JoinColumn({name: 'sub_category_id'})
  subCategory: any;

  @ManyToOne('User', 'ingredients')
  @JoinColumn({name: 'user_id'})
  user: any;

  @OneToMany('RecipeIngredient', 'ingredient')
  recipeIngredients: any[];

  @OneToMany('MainIngredient', 'ingredient')
  mainIngredients: any[];
}

/**
 * 레시피 게시물 엔티티
 */
@Entity('recipe_post')
export class RecipePost {
  @PrimaryGeneratedColumn('uuid')
  recipe_post_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'varchar', length: 100})
  title: string;

  @Column({type: 'text', nullable: true})
  description?: string;

  @Column({type: 'geography', spatialFeatureType: 'Point', srid: 4326})
  location: Point;

  @Column({type: 'int', default: 0})
  like_count: number;

  @Column({type: 'int', default: 0})
  comment_count: number;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  @Column({type: 'smallint', nullable: true})
  type?: number;

  @Column({type: 'boolean', default: false})
  delete_yn: boolean;

  @Column({type: 'timestamptz', nullable: true})
  deleted_at?: Date;

  @Column({type: 'boolean', default: false})
  is_default: boolean;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'user_id')
  @JoinColumn({name: 'user_id'})
  user: any;

  @OneToMany('RecipeRelation', 'recipePost')
  relations: any[];

  @OneToMany('RecipePostImage', 'recipePost')
  images: any[];

  @OneToMany('RecipeIngredient', 'recipePost')
  ingredients: any[];

  @OneToMany('RecipeStep', 'recipePost')
  steps: any[];

  @OneToMany('Like', 'recipePost')
  likes: any[];
}

/**
 * 레시피 관계 엔티티
 */
@Entity('recipe_relations')
export class RecipeRelation {
  @PrimaryColumn({type: 'uuid'})
  recipe_post_id: string;

  @PrimaryColumn({type: 'int'})
  type: number;

  @PrimaryColumn({type: 'int'})
  child_id: number;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('RecipePost', 'relations')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;
}

/**
 * 레시피 게시물 이미지 엔티티
 */
@Entity('recipe_post_images')
export class RecipePostImage {
  @PrimaryGeneratedColumn('uuid')
  image_id: string;

  @Column({type: 'uuid'})
  recipe_post_id: string;

  @Column({type: 'text'})
  image_url: string;

  @Column({type: 'smallint', default: 0})
  sequence: number;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('RecipePost', 'images')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;
}

/**
 * 레시피 재료 엔티티
 */
@Entity('recipe_ingredients')
export class RecipeIngredient {
  @PrimaryColumn({type: 'uuid'})
  recipe_post_id: string;

  @PrimaryColumn({type: 'int'})
  ingredient_id: number;

  @Column({type: 'numeric'})
  quantity: number;

  @Column({type: 'varchar', length: 20})
  unit: string;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('RecipePost', 'ingredients')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;

  @ManyToOne('Ingredient', 'recipeIngredients')
  @JoinColumn({name: 'ingredient_id'})
  ingredient: any;
}

/**
 * 레시피 단계 엔티티
 */
@Entity('recipe_steps')
export class RecipeStep {
  @PrimaryGeneratedColumn('uuid')
  step_id: string;

  @Column({type: 'uuid'})
  recipe_post_id: string;

  @Column({type: 'smallint'})
  step_number: number;

  @Column({type: 'text'})
  instruction: string;

  @Column({type: 'text', nullable: true})
  image_url?: string;

  @Column({type: 'text', nullable: true})
  video_url?: string;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('RecipePost', 'steps')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;
}
