import "@fontsource-variable/outfit";
import "@fontsource-variable/fraunces";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { pb } from "@/lib/pb";
import { applyTheme, useThemeStore } from "@/stores";
import { applyStyle, loadBackdrop } from "@/features/style";

applyTheme(useThemeStore.getState().theme);
applyStyle();
void loadBackdrop();

// Refresh the cached auth record on boot so account-stored art (avatar +
// page-icon doodles) is current on every load, not just after a fresh sign-in.
if (pb.authStore.isValid) {
  pb.collection("users")
    .authRefresh()
    .catch(() => {});
}

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
