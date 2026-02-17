 "use client";
 
 import Link, { type LinkProps } from "next/link";
 import { usePathname } from "next/navigation";
 import { useEffect, useRef } from "react";
 
 type Props = LinkProps & {
   className?: string;
   children: React.ReactNode;
   onClick?: React.MouseEventHandler<HTMLAnchorElement>;
 };
 
 function isModifiedEvent(event: React.MouseEvent<HTMLAnchorElement>) {
   return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
 }
 
 export function SafeLink({ href, onClick, children, ...rest }: Props) {
   const pathname = usePathname();
   const fallbackTimerRef = useRef<number | null>(null);
 
   useEffect(() => {
     if (fallbackTimerRef.current != null) {
       window.clearTimeout(fallbackTimerRef.current);
       fallbackTimerRef.current = null;
     }
   }, [pathname]);
 
   return (
     <Link
       {...rest}
       href={href}
       prefetch={false}
       onClick={(event) => {
         onClick?.(event);
         if (event.defaultPrevented || isModifiedEvent(event)) return;
 
         const start = `${window.location.pathname}${window.location.search}`;
         const target = typeof href === "string" ? href : href.toString();
         if (!target || target === start) return;
 
         if (fallbackTimerRef.current != null) {
           window.clearTimeout(fallbackTimerRef.current);
         }
 
         // If the App Router doesn't advance, fall back to a hard navigation.
         fallbackTimerRef.current = window.setTimeout(() => {
           const current = `${window.location.pathname}${window.location.search}`;
           if (current === start) window.location.assign(target);
         }, 1200);
       }}
     >
       {children}
     </Link>
   );
 }
