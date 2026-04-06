import type { HTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

interface CardProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {
  className?: string;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <section className={clsx("card", className)} {...props}>
      {children}
    </section>
  );
}
