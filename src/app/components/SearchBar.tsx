import React from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
      <Input
        type="text"
        placeholder=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full border-2 rounded-md pl-10 pr-4 text-base font-medium text-black bg-white/95"
      />
    </div>
  );
}