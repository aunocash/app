"use client";

import { useEffect, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

type SearchItem = { id: string; title: string; group: string };

export function DocsSearch({ items }: { items: SearchItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = items.filter((item) => (item.title + " " + item.group).toLowerCase().includes(query.toLowerCase()));

  return <>
    <button className="docs-portal-search-trigger" type="button" onClick={() => setOpen(true)} aria-label="Search documentation">
      <FiSearch aria-hidden="true" /><span>Search documentation...</span><kbd>⌘ K</kbd>
    </button>
    {open && <div className="docs-portal-search-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <div className="docs-portal-search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation" onMouseDown={(event) => event.stopPropagation()}>
        <div className="docs-portal-search-input"><FiSearch aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation..." /><button type="button" onClick={() => setOpen(false)} aria-label="Close search"><FiX aria-hidden="true" /></button></div>
        <div className="docs-portal-search-results">{results.length > 0 ? results.map((item) => <a href={"#" + item.id} key={item.id} onClick={() => setOpen(false)}><span>{item.group}</span><strong>{item.title}</strong></a>) : <p>No matching documentation.</p>}</div>
      </div>
    </div>}
  </>;
}
