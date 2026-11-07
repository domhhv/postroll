import { TabsContent } from '@postroll/ui/components/tabs';

import { DeleteAccount } from '#components/delete-account';
import { ProfileForm } from '#components/profile-form';
import { getUser, getWorkspaces, redirectToSessionCheck } from '#lib/dal';

export default async function ProfileSettingsPage() {
  const [user, workspaces] = await Promise.all([getUser(), getWorkspaces()]);

  if (!user) {
    redirectToSessionCheck('/settings/profile');
  }

  return (
    <TabsContent value="profile" className="min-w-0 space-y-10">
      <section className="max-w-md">
        <ProfileForm user={user} />
      </section>
      <section className="space-y-4">
        <h2 className="text-destructive text-lg font-semibold tracking-tight">Danger zone</h2>
        <DeleteAccount email={user.email} workspaces={workspaces} />
      </section>
    </TabsContent>
  );
}
