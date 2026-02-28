import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { CategoriesController } from './categories.controller.js';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // CategoriesService is exported so TransactionsModule can inject it
  // for category ownership validation when creating transactions.
  exports: [CategoriesService],
})
export class CategoriesModule {}
