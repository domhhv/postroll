import { TabsContent } from '@postroll/ui/components/tabs';

import { ChangePasswordForm } from '#components/change-password-form';
import { Sessions } from '#components/sessions';
import { listSessions } from '#lib/api';
import { redirectToSessionCheck } from '#lib/dal';
import { GatewayError } from '#lib/refresh';

export default async function ProfileSecuritySettingsPage() {
  const sessions = await listSessions().catch((error: unknown) => {
    if (error instanceof GatewayError && error.status === 401) {
      redirectToSessionCheck('/settings/security');
    }

    throw error;
  });

  return (
    <TabsContent value="security" className="min-w-0 space-y-10">
      <section className="max-w-md">
        <ChangePasswordForm />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Sessions</h2>
        <Sessions sessions={sessions} />
      </section>
    </TabsContent>
  );
}
