import type { ComponentProps } from "react";
import { Sticker, StickerLink, type StickerTone } from "@/components/zine/Torn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const tones: Record<Variant, StickerTone> = {
  primary: "orange",
  secondary: "navy",
  ghost: "paper",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-[14px]",
  lg: "h-14 px-8 text-[18px]",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
  seed?: number;
  tilt?: number;
}

/** Torn-paper sticker buttons in the Nema palette. */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & StyleProps) {
  return <Sticker tone={tones[variant]} className={`${sizes[size]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof StickerLink> & StyleProps) {
  return <StickerLink tone={tones[variant]} className={`${sizes[size]} ${className}`} {...props} />;
}
