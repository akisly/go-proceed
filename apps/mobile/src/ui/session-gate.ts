import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useNativeRuntime } from "../lib/native/runtime";

export function useSessionGate(next = "/") {
  const runtime = useNativeRuntime();
  const router = useRouter();
  useEffect(() => {
    if (runtime.status !== "booting" && !runtime.session) {
      router.replace({ pathname: "/login", params: { next } });
    }
  }, [runtime.status, runtime.session, router, next]);
  return runtime;
}
