import { useEffect, useState } from "react";
import { Input } from "../ui/input";

export function SearchBar({ onSearch }: { onSearch: (seach: string) => void }) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      onSearch(search);
    }, 700);

    return () => {
      clearTimeout(timeout);
    };
  }, [search, onSearch]);

  return (
    <Input
      className="bg-slate-100 border-slate-200"
      placeholder="Search something..."
      value={search}
      onChange={(ev) => {
        setSearch(ev.target.value);
      }}
    />
  );
}
