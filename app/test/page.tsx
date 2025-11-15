import NovelEditor from "@/components/editor/NovelEditor";

export default function TestPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Novel Editor Test</h1>
      <div className="border rounded-lg p-4">
        <NovelEditor />
      </div>
    </div>
  );
}
