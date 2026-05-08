import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RbacService } from './rbac.service';
import { RbacController, SuperAdminController } from './rbac.controller';
import { SuperAdmin } from '../super-admin/super-admin.entity';
import { ModuleDefinition } from './module-definition.entity';
import { FirmModuleAccess } from './firm-module-access.entity';
import { RoleModulePermission } from './role-module-permission.entity';
import { ConfiguratorModule } from '../config/configurator.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SuperAdmin, ModuleDefinition, FirmModuleAccess, RoleModulePermission]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
    ConfiguratorModule,
  ],
  controllers: [RbacController, SuperAdminController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
