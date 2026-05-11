import { SimpleSteps } from "@/components/AppPrimitives";
import { ImportTools } from "@/components/ImportTools";
import { PageHeader } from "@/components/PageHeader";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Add Results"
        description="Paste results or a meet link. The app will turn them into rows you can check."
      />
      <SimpleSteps
        steps={[
          {
            title: "Paste results",
            detail: "Use the big text box for copied results.",
          },
          {
            title: "Click read",
            detail: "The app makes a table from the text.",
          },
          {
            title: "Check rows",
            detail: "Review names, schools, events, and marks.",
          },
        ]}
      />
      <ImportTools />
    </div>
  );
}
