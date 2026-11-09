import "./globals.css";
export const metadata = {
  title: "Baseline | Tennis intelligence",
  description:
    "Explore ATP match probabilities using historical results, a trained statistical model, and current news.",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
