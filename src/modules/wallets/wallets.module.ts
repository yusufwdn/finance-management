import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service.js';
import { WalletsController } from './wallets.controller.js';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService],
  // WalletsService is exported so TransactionsModule can inject it
  // for ownership checks (does this wallet belong to the user?)
  exports: [WalletsService],
})
export class WalletsModule {}
