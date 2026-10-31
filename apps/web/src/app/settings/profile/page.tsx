import { TabsContent } from '@postroll/ui/components/tabs';

import { ProfileForm } from '#components/profile-form';
import { getUser, redirectToSessionCheck } from '#lib/dal';

export default async function ProfileSettingsPage() {
  const user = await getUser();

  if (!user) {
    redirectToSessionCheck('/settings/profile');
  }

  return (
    <TabsContent value="profile" className="max-w-md">
      <ProfileForm user={user} />
    </TabsContent>
  );
}
