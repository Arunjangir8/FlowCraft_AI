import { http } from "./http";

export function getServerHealth() {
  return http.public.get("/health");
}
