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
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");

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

  async function createNewNote() {
    if (!newNoteTitle.trim()) return;

    const slug = newNoteTitle.toLowerCase().replace(/\s+/g, "-");
    const content = `---
title: ${newNoteTitle}
tags: []
---

# ${newNoteTitle}

Start writing...
`;

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, content }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/editor/${slug}`);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error("Failed to create note:", err);
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
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Synapse</h1>
        <p className="text-gray-600">Your local-first markdown notes</p>
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
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? "Cancel" : "+ New Note"}
        </Button>
      </div>

      {/* Create Note Form */}
      {isCreating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Note</CardTitle>
            <div className="flex gap-2 mt-4">
              <Input
                type="text"
                placeholder="Note title..."
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createNewNote();
                }}
                autoFocus
              />
              <Button onClick={createNewNote}>Create</Button>
            </div>
          </CardHeader>
        </Card>
      )}

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
          <Button onClick={() => setIsCreating(true)}>+ New Note</Button>
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
