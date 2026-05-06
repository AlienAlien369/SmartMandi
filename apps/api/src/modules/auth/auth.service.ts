import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

interface UserRecord {
  id: string;
  firm_id: string;
  phone: string;
  role: string;
  is_active: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; firm_id: string; role: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    if (this.configService.get('app.nodeEnv') !== 'development') {
      throw new UnauthorizedException('OTP verification not yet implemented');
    }

    // Dev mode: look up user from DB by phone + firm_id; accept any OTP
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let user: UserRecord | null = null;
    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${dto.firm_id}'`);
      const rows = await qr.query(
        `SELECT id, firm_id, phone, role, is_active FROM users WHERE phone = $1 AND firm_id = $2 AND is_active = true LIMIT 1`,
        [dto.phone, dto.firm_id],
      );
      if (rows.length > 0) user = rows[0] as UserRecord;
      await qr.commitTransaction();
    } catch {
      await qr.rollbackTransaction();
    } finally {
      await qr.release();
    }

    // Fallback to default FIRM_HEAD user for backwards compatibility
    if (!user) {
      user = {
        id: '5e138578-f0a6-4679-a463-79730d20b035',
        firm_id: dto.firm_id,
        phone: dto.phone,
        role: 'FIRM_HEAD',
        is_active: true,
      };
    }

    return this.generateTokens(user, dto.device_id);
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);
      const accessToken = this.jwtService.sign(
        { sub: payload.sub, firm_id: payload.firm_id, role: payload.role },
        { expiresIn: this.configService.get('jwt.accessExpiresIn') },
      );
      return { access_token: accessToken, expires_in: 3600 };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokens(user: UserRecord, deviceId?: string): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      firm_id: user.firm_id,
      role: user.role as JwtPayload['role'],
      device_id: deviceId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.accessExpiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      user: { id: user.id, firm_id: user.firm_id, role: user.role },
    };
  }
}
