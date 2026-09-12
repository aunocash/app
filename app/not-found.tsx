import Link from "next/link";
import { Navbar, Footer } from "@/components/site-shell";
export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="container page-main">
        <div className="page-intro">
          <div className="eyebrow">404 · NOTHING HERE YET</div>
          <h1>This link doesn’t lead anywhere.</h1>
          <p>
            The page or payment request is missing or invalid. Ask the sender
            for a complete link, or create a new request.
          </p>
        </div>
        <Link className="button primary" href="/dashboard/create">
          Create a payment
        </Link>
      </main>
      <Footer />
    </>
  );
}
