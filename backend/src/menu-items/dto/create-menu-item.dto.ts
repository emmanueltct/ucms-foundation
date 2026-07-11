import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export const MENU_ITEM_TARGET_TYPES = ['module', 'entity', 'report', 'dashboard', 'customPage', 'workflow'] as const;

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Reports' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: 'BarChart3', description: 'lucide-react icon name' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Parent menu item id, for a child/submenu entry' })
  @IsOptional()
  @IsString()
  parentMenuItemId?: string;

  @ApiProperty({ enum: MENU_ITEM_TARGET_TYPES })
  @IsIn(MENU_ITEM_TARGET_TYPES)
  targetType: (typeof MENU_ITEM_TARGET_TYPES)[number];

  @ApiProperty({
    example: '/admin/reports',
    description: 'Resolved by the frontend against targetType — a route path, a dynamic module key, a report slug, etc.',
  })
  @IsString()
  targetKey: string;

  @ApiPropertyOptional({ type: [String], description: 'Only these roles see this item; empty/omitted = every role' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleToRoleNames?: string[];

  @ApiPropertyOptional({ description: 'Only users assigned to this branch (or a descendant) see this item; omitted = every branch' })
  @IsOptional()
  @IsString()
  visibleToBranchId?: string;
}
