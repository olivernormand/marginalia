"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to home if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-serif text-gray-900 mb-2">Marginalia</h1>
        <p className="text-gray-500">Listen deeply, note carefully</p>
      </div>

      <div className="w-full max-w-sm">
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#111827",
                  brandAccent: "#374151",
                  inputBackground: "white",
                  inputBorder: "#d1d5db",
                  inputBorderFocus: "#111827",
                  inputBorderHover: "#9ca3af",
                },
                borderWidths: {
                  buttonBorderWidth: "1px",
                  inputBorderWidth: "1px",
                },
                radii: {
                  borderRadiusButton: "0.5rem",
                  buttonBorderRadius: "0.5rem",
                  inputBorderRadius: "0.5rem",
                },
                fontSizes: {
                  baseBodySize: "14px",
                  baseInputSize: "14px",
                  baseLabelSize: "14px",
                  baseButtonSize: "14px",
                },
              },
            },
            className: {
              container: "auth-container",
              button: "auth-button",
              input: "auth-input",
            },
          }}
          providers={[]}
          redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/`}
          localization={{
            variables: {
              sign_in: {
                email_label: "Email",
                password_label: "Password",
                button_label: "Sign in",
                link_text: "Already have an account? Sign in",
              },
              sign_up: {
                email_label: "Email",
                password_label: "Password",
                button_label: "Create account",
                link_text: "Don't have an account? Sign up",
              },
            },
          }}
        />
      </div>
    </div>
  );
}
