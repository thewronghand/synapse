"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();

      if (data.success) {
        setDocuments(data.data.documents);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Synapse</h1>
          <p className="text-gray-600">Your local-first markdown notes</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          View Graph
        </Button>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        <Input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button onClick={() => router.push("/editor/new")}>
          + New Note
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 text-sm text-gray-600">
        {filteredDocuments.length} {filteredDocuments.length === 1 ? "note" : "notes"}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Documents List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocuments.map((doc) => (
          <Card
            key={doc.slug}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/note/${doc.slug}`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{doc.title}</CardTitle>
              <CardDescription>
                <div className="flex flex-col gap-1 text-xs">
                  <span>Updated: {new Date(doc.updatedAt).toLocaleDateString()}</span>
                  {doc.links.length > 0 && (
                    <span>{doc.links.length} links</span>
                  )}
                  {doc.backlinks.length > 0 && (
                    <span>{doc.backlinks.length} backlinks</span>
                  )}
                  {doc.frontmatter.tags && doc.frontmatter.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {doc.frontmatter.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredDocuments.length === 0 && !searchQuery && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No notes yet. Create your first note!</p>
          <Button onClick={() => router.push("/editor/new")}>+ New Note</Button>
        </div>
      )}

      {/* No Search Results */}
      {filteredDocuments.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <p className="text-gray-600">No notes found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}
