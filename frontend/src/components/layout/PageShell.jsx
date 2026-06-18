import NavBar from "./NavBar";

export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-white">
      <NavBar />
      <main>{children}</main>
    </div>
  );
}
