/**
 * Applies the stored SOC theme before paint. Scoped to the SOC attribute so the
 * existing authentication screens keep their original dark presentation.
 */
export function SocThemeScript() {
  const script = `
(function () {
  try {
    var stored = window.localStorage.getItem("soc-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-soc-theme", theme);
  } catch (error) {
    document.documentElement.setAttribute("data-soc-theme", "dark");
  }
})();
`;

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
