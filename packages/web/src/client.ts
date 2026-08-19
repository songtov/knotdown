export const AGENT_CLIENT_SCRIPT = `"use strict";
(() => {
  const button = document.getElementById("copy-context");
  const output = document.getElementById("context-output");
  if (!(button instanceof HTMLButtonElement) || !(output instanceof HTMLElement)) return;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.textContent ?? "");
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
  });
})();
`;
