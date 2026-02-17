 "use client";
 
 import { useEffect, useMemo, useRef, useState } from "react";
 import { AppButton } from "@/components/ds/AppButton";
 import { Surface } from "@/components/ds/Surface";
 
 type ClientErrorInfo = {
   name?: string;
   message: string;
   stack?: string;
   href: string;
   at: string;
 };
 
 function normalizeError(err: unknown): { name?: string; message: string; stack?: string } {
   if (err instanceof Error) return { name: err.name, message: err.message || "Unknown error", stack: err.stack };
   if (typeof err === "string") return { message: err };
   if (err && typeof err === "object" && "message" in err) {
     const msg = String((err as { message?: unknown }).message ?? "Unknown error");
     const name = "name" in err ? String((err as { name?: unknown }).name ?? "") : undefined;
     const stack = "stack" in err ? String((err as { stack?: unknown }).stack ?? "") : undefined;
     return { name, message: msg, stack };
   }
   return { message: "Unknown error" };
 }
 
 async function sendToServer(payload: ClientErrorInfo) {
   try {
     const body = JSON.stringify(payload);
     if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
       navigator.sendBeacon("/api/client-error", body);
       return;
     }
     await fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body });
   } catch {
     // ignore
   }
 }
 
 export function ClientErrorReporter() {
   const [errorInfo, setErrorInfo] = useState<ClientErrorInfo | null>(null);
   const didReportRef = useRef(false);
 
   useEffect(() => {
     function report(err: unknown) {
       const normalized = normalizeError(err);
       const info: ClientErrorInfo = {
         ...normalized,
         message: normalized.message || "Unknown error",
         href: window.location.href,
         at: new Date().toISOString()
       };
       setErrorInfo(info);
       if (!didReportRef.current) {
         didReportRef.current = true;
         void sendToServer(info);
       }
     }
 
     function onError(event: ErrorEvent) {
       report(event.error ?? event.message);
     }
 
     function onUnhandledRejection(event: PromiseRejectionEvent) {
       report(event.reason);
     }
 
     window.addEventListener("error", onError);
     window.addEventListener("unhandledrejection", onUnhandledRejection);
     return () => {
       window.removeEventListener("error", onError);
       window.removeEventListener("unhandledrejection", onUnhandledRejection);
     };
   }, []);
 
   const details = useMemo(() => {
     if (!errorInfo) return null;
     const lines = [errorInfo.name, errorInfo.message, errorInfo.stack].filter(Boolean).join("\n");
     return lines || null;
   }, [errorInfo]);
 
   if (!errorInfo) return null;
 
   return (
     <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-6 md:max-w-[520px]">
       <Surface className="border border-rose-400/20 bg-rose-500/[0.08]">
         <div className="text-sm font-semibold text-rose-100">Something went wrong on this page</div>
         <div className="mt-1 text-xs text-rose-100/70">
           We captured the error and sent it for review. You can try reloading or logging out.
         </div>
         {details ? (
           <details className="mt-3 text-xs text-rose-100/70">
             <summary className="cursor-pointer select-none">Details</summary>
             <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-rose-200/10 bg-rose-950/30 p-2">
               {details}
             </pre>
           </details>
         ) : null}
         <div className="mt-4 flex flex-wrap gap-2">
           <AppButton intent="primary" onPress={() => window.location.reload()}>
             Reload
           </AppButton>
           <AppButton intent="secondary" onPress={() => window.location.assign("/logout")}>
             Logout
           </AppButton>
           <AppButton intent="ghost" onPress={() => setErrorInfo(null)}>
             Dismiss
           </AppButton>
         </div>
       </Surface>
     </div>
   );
 }
