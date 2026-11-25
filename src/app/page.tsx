import { AuthShell } from "@/components/auth/AuthShell";
import { PlatformBrand } from "@/features/platform/components/PlatformBrand";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/features/platform/brand";

export const metadata = { title: PLATFORM_NAME, description: PLATFORM_TAGLINE };

/**
 * The shared business address without a business (e.g. hubwise-app.vercel.app/). A business's own
 * domain never reaches this page: the proxy opens its default business instead. Never names a client.
 */
export default function HomePage() {
  return <AuthShell neutral brand={<PlatformBrand subtitle={PLATFORM_TAGLINE} />} brandName={PLATFORM_NAME}
    title="Open your business's link" subtitle="Each business on Hubwise has its own sign-in address.">
    <div className="space-y-3 text-center text-sm text-muted-foreground">
      <p>Use the link your business shared with you. It ends with your business&apos;s name, like <span className="font-mono text-foreground">/your-business</span>.</p>
      <p>Don&apos;t have it? Ask your business admin.</p>
    </div>
  </AuthShell>;
}
