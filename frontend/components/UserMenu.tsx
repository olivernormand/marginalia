"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User } from "lucide-react";

export default function UserMenu() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <div className="w-8 h-8" />; // Placeholder to prevent layout shift
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <User size={16} />
        <span>{user.email}</span>
      </div>
      <button
        onClick={signOut}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        title="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
