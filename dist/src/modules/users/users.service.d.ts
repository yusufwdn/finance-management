import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
export declare const userSelect: {
    readonly id: true;
    readonly email: true;
    readonly firstName: true;
    readonly lastName: true;
    readonly createdAt: true;
    readonly updatedAt: true;
};
export type SafeUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
};
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateUserDto): Promise<SafeUser>;
    findById(id: string): Promise<SafeUser>;
    findByEmail(email: string): Promise<{
        id: string;
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    update(id: string, dto: UpdateUserDto): Promise<SafeUser>;
}
