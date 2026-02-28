import { UsersService, type SafeUser } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(user: SafeUser): Promise<SafeUser>;
    updateProfile(user: SafeUser, dto: UpdateUserDto): Promise<SafeUser>;
}
