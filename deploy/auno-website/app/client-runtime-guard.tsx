"use client";

function isExternalSenderError(reason: unknown) {
  return String(reason).includes("_sender is not defined");
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (isExternalSenderError(event.message)) event.preventDefault();
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (isExternalSenderError(event.reason)) event.preventDefault();
  });
}

export function ClientRuntimeGuard() {
  return null;
}
