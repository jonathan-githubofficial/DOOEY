import "@fontsource-variable/outfit";
import "@fontsource-variable/fraunces";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { router } from "./router";
import { applyTheme, useThemeStore } from "@/stores";
import { initSession } from "@/features/auth";
import { applyStyle, loadBackdrop } from "@/features/style";

applyTheme(useThemeStore.getState().theme);
applyStyle();
void loadBackdrop();
void initSession();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Honours prefers-reduced-motion for every motion/react animation in the
          app: transforms are dropped, opacity still crossfades. Components get
          it for free and must not re-implement the check. */}
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
