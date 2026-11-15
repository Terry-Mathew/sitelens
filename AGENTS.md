<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SiteLens agent rules

Read `CLAUDE.md` first. It gives the session start steps, the product rules, the security rules, and the approval gates. Those rules apply to all agents and all tools.

## Writing rules: Simplified Technical English

All text in this repository must use ASD-STE100 Simplified Technical English. This rule applies to agent replies, commit messages, pull request descriptions, documentation, code comments, and user interface text.

### Sentence rules

1. Write short sentences. A procedure step must have 20 words or fewer. A description must have 25 words or fewer.
2. Write one instruction in each sentence.
3. Use the active voice. Name the actor.
4. Use "must" for a requirement. Use "can" for a possibility.
5. Use simple verb tenses: present, past, and future.
6. Do not use "-ing" words as nouns. Write "before you start", not "before starting".
7. Do not use a semicolon. Write two sentences.
8. Do not put more than three nouns together. Write "the length of the page title", not "page title length check".
9. Write the article: "a", "an", or "the".
10. Do not use contractions. Write "do not", not "don't".
11. Do not use idioms, jokes, or metaphors.
12. Do not use one word with two meanings in the same text.

### Word rules

1. Use one word for one thing. Do not use a synonym for the same object. For example, always write "finding". Do not also write "issue item" or "result row" for the same object.
2. Define a technical word the first time you use it.
3. Use a noun for an object. Use a verb for an action.
4. Do not use a phrasal verb when one verb is clear.

### Project terms

Use these terms with one meaning each: scan, check, finding, evidence, severity, observation, limitation, report, report draft, technical view, client view.

### Scope

This rule applies to new text. Do not rewrite an existing document to obey this rule unless the founder asks.

A full check also needs the approved dictionary in the official standard. This file gives the sentence rules only. If a word is not in the dictionary, use a common word with one meaning.

Text in the client PDF must also be plain language for a business owner who is not technical.
