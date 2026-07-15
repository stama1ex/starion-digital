import AccountSettings from '@/components/account/account-settings';
import { Container } from '@/components/shared/container';

export default async function MyAccountPage() {
  return (
    <main className="min-h-screen bg-background">
      <Container className="py-12 px-4 md:px-0">
        <AccountSettings />
      </Container>
    </main>
  );
}
