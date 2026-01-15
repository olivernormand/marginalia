"use client";

import UserMenu from "./UserMenu";

export default function Header() {
  return (
    <div className="mb-16">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-serif mb-3 text-gray-900">marginalia</h1>
          <p className="text-gray-500 text-lg">Listen deeply, note carefully</p>
        </div>
        <UserMenu />
      </div>
    </div>
  );
}
