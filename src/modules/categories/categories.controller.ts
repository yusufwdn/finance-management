import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { type SafeUser } from '../users/users.service.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CategoryType } from '../../../generated/prisma/client.js';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // POST /api/categories
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.id, dto);
  }

  // GET /api/categories
  // GET /api/categories?type=EXPENSE
  // GET /api/categories?type=INCOME
  @Get()
  findAll(
    @CurrentUser() user: SafeUser,
    @Query('type') type?: CategoryType,
  ) {
    return this.categoriesService.findAll(user.id, type);
  }

  // GET /api/categories/:id
  @Get(':id')
  findOne(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoriesService.findOne(id, user.id);
  }

  // PATCH /api/categories/:id
  @Patch(':id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, user.id, dto);
  }

  // DELETE /api/categories/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoriesService.remove(id, user.id);
  }
}
