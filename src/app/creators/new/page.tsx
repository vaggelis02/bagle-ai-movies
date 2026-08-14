import { redirect } from "next/navigation";
import { FilmUploader } from "@/components/film-uploader";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Upload a film" };

export default async function NewFilmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/creators/new");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Upload a film</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Describe it first, then send the video. It stays a private draft until
        you submit it for review.
      </p>
      <div className="mt-8">
        <FilmUploader />
      </div>
    </main>
  );
}
