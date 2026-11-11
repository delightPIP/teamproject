import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" };

export function Button({ variant = "secondary", className, type = "button", ...rest }: Props) {
  return <button type={type} className={`btn btn--${variant}${className ? ` ${className}` : ""}`} {...rest} />;
}
