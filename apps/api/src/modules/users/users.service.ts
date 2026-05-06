import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto, firmId: string, createdBy: string): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { phone: dto.phone, firm_id: firmId } });
    if (existing) throw new ConflictException(`User with phone ${dto.phone} already exists`);

    const user = this.userRepo.create({ ...dto, firm_id: firmId, created_by: createdBy });
    return this.userRepo.save(user);
  }

  async findAll(firmId: string, page?: number, limit?: number): Promise<{ data: User[]; meta: object }> {
    const p = Math.max(1, Number(page || 1));
    const l = Math.min(100, Math.max(1, Number(limit || 50)));
    const [data, total] = await this.userRepo.findAndCount({
      where: { firm_id: firmId },
      order: { created_at: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
    return { data, meta: { total, page: p, limit: l } };
  }

  async findOne(id: string, firmId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, firm_id: firmId } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByPhone(phone: string, firmId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone, firm_id: firmId, is_active: true } });
  }

  async update(id: string, dto: UpdateUserDto, firmId: string): Promise<User> {
    const user = await this.findOne(id, firmId);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async deactivate(id: string, firmId: string): Promise<void> {
    const user = await this.findOne(id, firmId);
    user.is_active = false;
    await this.userRepo.save(user);
  }
}
