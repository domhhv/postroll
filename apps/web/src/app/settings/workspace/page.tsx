import { TabsContent } from '@postroll/ui/components/tabs';

import { WorkspaceForm } from '#components/workspace-form';
import { WorkspaceMembers } from '#components/workspace-members';
import { getWorkspaceMembers } from '#lib/api';
import { getUser, getActiveWorkspace, redirectToSessionCheck } from '#lib/dal';
import { GatewayError } from '#lib/refresh';

export default async function WorkspaceSettingsPage() {
  const [user, workspace] = await Promise.all([getUser(), getActiveWorkspace()]);

  if (!user || !workspace) {
    redirectToSessionCheck('/settings/workspace');
  }

  const members = await getWorkspaceMembers(workspace.id).catch((error: unknown) => {
    if (error instanceof GatewayError && error.status === 401) {
      redirectToSessionCheck('/settings/workspace');
    }

    throw error;
  });

  return (
    <TabsContent value="workspace" className="min-w-0 space-y-10">
      <section className="max-w-md">
        <WorkspaceForm key={workspace.id} workspace={workspace} />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Members</h2>
        <WorkspaceMembers members={members} currentUserId={user.id} currentRole={workspace.role} />
      </section>
    </TabsContent>
  );
}
