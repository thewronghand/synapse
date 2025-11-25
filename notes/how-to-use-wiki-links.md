---
title: How to Use Wiki Links
tags: [guide, features]
---

# How to Use Wiki Links

Wiki links are the heart of Synapse's linking system.

## Basic Syntax

The simplest form:
```markdown
[[Note Name]]
```

This creates a link to a note called "Note Name".

## Advanced Features

### Custom Display Text

```markdown
[[actual-note-name|Display This Instead]]
```

### Linking to Headings

```markdown
[[Note Name#Heading]]
```

### Case Insensitive

Links are case-insensitive, so these are the same:
- `[[Getting Started]]`
- `[[getting started]]`
- `[[GETTING STARTED]]`

## Backlinks

When you link to a note, Synapse automatically tracks:
- **Links**: Notes you link to
- **Backlinks**: Notes that link to you

See the backlinks section at the bottom of each note.

## Graph View

All your wiki links are visualized in the [[Graph View]].

## Related

- [[Getting Started]]
- [[Graph View]]
- Back to [[index]]
