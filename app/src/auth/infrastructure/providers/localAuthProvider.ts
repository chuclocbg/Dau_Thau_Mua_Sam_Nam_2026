import type { AuthCredentials, PasswordCredentials } from '../../types/authTypes.ts'
import { AuthError } from '../../types/authTypes.ts'
import type { IAuthenticationProvider, IPasswordHasher, AuthUser } from '../../types/providerTypes.ts'
import type { IUserRepository } from '../authRepositories.ts'

export class LocalAuthProvider implements IAuthenticationProvider {
  readonly providerId = 'local'
  readonly providerType = 'local' as const

  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
  ) {}

  supports(credentialType: string): boolean {
    return credentialType === 'password'
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthUser> {
    if (credentials.credentialType !== 'password') {
      throw new AuthError('INVALID_CREDENTIALS', 'credentialType', 'LocalAuthProvider requires password credentials')
    }
    const creds = credentials as PasswordCredentials

    const user = await this.users.findByUsername(creds.username)
    if (!user) throw new AuthError('USER_NOT_FOUND', 'username', 'User not found')
    if (!user.isActive) throw new AuthError('USER_INACTIVE', 'username', 'User account is inactive')
    if (user.isLocked) throw new AuthError('USER_LOCKED', 'username', 'User account is locked')
    if (!user.passwordHash) throw new AuthError('INVALID_CREDENTIALS', 'password', 'No local password set')

    const valid = await this.hasher.verify(creds.password, user.passwordHash)
    if (!valid) throw new AuthError('INVALID_CREDENTIALS', 'password', 'Invalid credentials')

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      departmentId: user.departmentId,
      externalId: user.externalId,
      externalProvider: 'local',
      attributes: {},
    }
  }
}
