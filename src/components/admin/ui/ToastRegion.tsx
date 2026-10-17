import "server-only";
import { Toast } from "./Toast";
import { readToast } from "./toast-server";

/** Liest den Toast aus dem Cookie (flashToast) und zeigt ihn. Steht einmal in der Shell. */
export async function ToastRegion() {
  const toast = await readToast();
  return <Toast toast={toast} />;
}
