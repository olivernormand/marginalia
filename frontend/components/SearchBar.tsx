"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
}

export default function SearchBar({ query, onQueryChange, onSearch }: SearchBarProps) {
  return (
    <form onSubmit={onSearch} className="mb-8">
      <div className="flex items-center gap-3 border-b-2 border-gray-200 focus-within:border-gray-900 transition-colors pb-3">
        <Search className="text-gray-400 flex-shrink-0" size={20} />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search podcasts..."
          className="w-full text-2xl font-light outline-none bg-transparent"
        />
      </div>
    </form>
  );
}
