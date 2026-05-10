import { ImportTools } from "@/components/ImportTools";
import { PageHeader } from "@/components/PageHeader";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Import"
        description="Paste meet results or check source URLs without storing credentials. Manual imports are kept local to the current browser session."
      />
      <ImportTools />
    </div>
  );
}
