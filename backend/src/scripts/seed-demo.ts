import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';
import { UsersService } from '../modules/users/users.service';
import { WorkspacesService } from '../modules/workspaces/workspaces.service';
import { PagesService } from '../modules/pages/pages.service';
import { BlocksService } from '../modules/blocks/blocks.service';
import { ShareService } from '../modules/share/share.service';
import { WorkspaceRole } from '../modules/workspaces/entities/workspace-member.entity';
import { SharePermission } from '../modules/share/dto/create-share.dto';

async function ensureUser(
  authService: AuthService,
  usersService: UsersService,
  email: string,
  name: string,
  password: string,
) {
  const existing = await usersService.findByEmail(email);
  if (!existing) {
    await authService.register({ email, name, password });
  }
  return usersService.findByEmail(email);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const authService = app.get(AuthService);
    const usersService = app.get(UsersService);
    const workspacesService = app.get(WorkspacesService);
    const pagesService = app.get(PagesService);
    const blocksService = app.get(BlocksService);
    const shareService = app.get(ShareService);

    const password = 'StrongP@ssw0rd';

    const owner = await ensureUser(
      authService,
      usersService,
      'demo_owner@example.com',
      'Demo Owner',
      password,
    );
    const editor = await ensureUser(
      authService,
      usersService,
      'demo_editor@example.com',
      'Demo Editor',
      password,
    );
    const viewer = await ensureUser(
      authService,
      usersService,
      'demo_viewer@example.com',
      'Demo Viewer',
      password,
    );

    if (!owner || !editor || !viewer) {
      throw new Error('Failed to ensure demo users');
    }

    const ownerWorkspaces = await workspacesService.findAllForUser(owner.id);
    let workspace = ownerWorkspaces.find((w) => w.name === 'Demo Workspace');

    if (!workspace) {
      workspace = await workspacesService.create(
        { name: 'Demo Workspace', icon: '🚀' },
        owner.id,
      );
    }

    // Invite members if not already in workspace.
    try {
      await workspacesService.inviteMember(
        workspace.id,
        editor.email,
        WorkspaceRole.EDITOR,
        owner.id,
      );
    } catch {
      // ignore duplicate membership
    }

    try {
      await workspacesService.inviteMember(
        workspace.id,
        viewer.email,
        WorkspaceRole.VIEWER,
        owner.id,
      );
    } catch {
      // ignore duplicate membership
    }

    const tree = await pagesService.getPageTree(workspace.id, owner.id);
    let demoPage = tree.find((p) => p.title === 'Demo Page');

    if (!demoPage) {
      const createdPage = await pagesService.create(
        workspace.id,
        { title: 'Demo Page', icon: '📄' },
        owner.id,
      );
      demoPage = {
        id: createdPage.id,
        title: createdPage.title,
        icon: createdPage.icon,
        sortOrder: createdPage.sortOrder,
        children: [],
      };
    }

    const page = await pagesService.findOne(demoPage.id, owner.id);
    const existingText = (page.blocks || [])
      .map((b) => b.content || '')
      .join(' ');

    if (!existingText.includes('Welcome to demo workspace')) {
      await blocksService.create(
        page.id,
        {
          type: 'paragraph',
          content: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Welcome to demo workspace',
                  },
                ],
              },
            ],
          }),
        },
        owner.id,
      );

      await blocksService.create(
        page.id,
        {
          type: 'paragraph',
          content: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'This page is auto-seeded for a 2-3 minute demo flow.',
                  },
                ],
              },
            ],
          }),
        },
        owner.id,
      );
    }

    const share = await shareService.create(page.id, owner.id, {
      permission: SharePermission.VIEW,
    });

    const summary = {
      users: {
        owner: owner.email,
        editor: editor.email,
        viewer: viewer.email,
        password,
      },
      workspaceId: workspace.id,
      pageId: page.id,
      shareToken: share.token,
      shareUrlPath: `/api/v1/share/${share.token}`,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
