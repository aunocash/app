import { Info } from "lucide-react";
import { EditorialPage } from "@/components/editorial-page";
import { Roadmap } from "@/components/content";
export const metadata = { title: "Roadmap" };
export default function RoadmapPage() {
  return (
    <EditorialPage
      label="BUILDING IN THE OPEN"
      title="A foundation for what’s next."
      description="Five phases toward programmable payment infrastructure. Clear scope and honest progress."
    >
      <div className="notice">
        <Info size={16} />
        <span>
          Current release: interactive product preview. Foundation work is in
          development; no live settlement is claimed. Future phases have no
          committed launch dates.
        </span>
      </div>
      <Roadmap />
    </EditorialPage>
  );
}
