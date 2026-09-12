import { Navbar, Footer } from "./site-shell";
export function EditorialPage({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main id="main-content" className="container page-main">
        <div className="page-intro">
          <div className="eyebrow">{label}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </main>
      <Footer />
    </>
  );
}
