import { http } from "./http";
import type { HealthResponse } from "../types/health";

export function getServerHealth() {
  return http.public.get<HealthResponse>("/health");
}
