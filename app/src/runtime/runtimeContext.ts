import type { Application } from '../bootstrap/buildApplication.ts'
import type { ISessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'
import { buildMemorySessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'
import type { IAttachmentReferenceRepository } from '../storage/infrastructure/storageRepositories.ts'
import { buildMemoryStorageRepositories } from '../storage/infrastructure/memoryStorageRepositories.ts'

// ── RuntimeContext — Phase X.11 Runtime dependency composition ────────────────
// The Application Runtime's own composition root, mirroring buildApplication.ts's (Phase X.9.1,
// frozen) own pattern exactly: a plain options-in, wired-object-out function, never a class,
// never a container/framework. Never modifies buildApplication.ts -- composes its already-built
// Application object wholesale as one member, adding only the two genuinely-new dependencies
// this milestone introduces (session + attachment repositories). Defaults to memory-backed
// repositories, matching buildApplication()'s own current use of memory-backed knowledge
// repositories and this project's established "memory-first, Prisma-backed follows as an
// explicit opt-in, never assumed live" convention (see docs/prisma-production.md).

export interface RuntimeContext {
  readonly application: Application
  readonly sessionRepository: ISessionRepository
  readonly attachmentRepository: IAttachmentReferenceRepository
}

export interface BuildRuntimeContextOptions {
  readonly application: Application
  readonly sessionRepository?: ISessionRepository
  readonly attachmentRepository?: IAttachmentReferenceRepository
}

export function buildRuntimeContext(options: BuildRuntimeContextOptions): RuntimeContext {
  return {
    application: options.application,
    sessionRepository: options.sessionRepository ?? buildMemorySessionRepository(),
    attachmentRepository: options.attachmentRepository ?? buildMemoryStorageRepositories().attachmentReferences,
  }
}
