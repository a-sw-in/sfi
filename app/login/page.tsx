"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { cachePlayer } from "../lib/player-session";

export default function LoginPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(false);
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").replace(/\D/g, "");

    try {
      const { data: existingPlayer, error: lookupError } = await supabase
        .from("players")
        .select("name, phone")
        .eq("phone", phone)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingPlayer) {
        if (existingPlayer.name.trim().toLowerCase() !== name.toLowerCase()) {
          setError("This phone number is already taken.");
          return;
        }

        cachePlayer({ name: existingPlayer.name, phone: existingPlayer.phone });
        router.push("/");
        return;
      }

      const { error: insertError } = await supabase
        .from("players")
        .insert({ name, phone });

      if (insertError) {
        if (insertError.code === "23505") {
          setError("This phone number is already taken.");
          return;
        }
        throw insertError;
      }

      cachePlayer({ name, phone });
      router.push("/");
    } catch (submitError) {
      console.error("Unable to log in player", submitError);
      setError("We could not save your details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main>
      <header className="site-header">
        <Link className="back-button" href="/">← Back</Link>
        <h1>Know Your Candidate</h1>
        <span className="header-space" />
      </header>

      <section className="login-page" aria-labelledby="login-title">
        <div className="section-label">WELCOME BACK</div>
        <h2 id="login-title">Log in to play.</h2>
        <p className="login-intro">Enter your details to continue your candidate journey.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" placeholder="Your name" required />
          <label htmlFor="phone">Phone number</label>
          <input id="phone" name="phone" type="tel" placeholder="Your phone number" required />
          <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Checking..." : "Login"}</button>
        </form>
        {submitted && <p className="login-success" role="status">You are ready to play!</p>}
        {error && <p className="login-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
