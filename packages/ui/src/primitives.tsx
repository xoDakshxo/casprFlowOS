import type { ComponentPropsWithoutRef } from "react";

const joinClassNames = (...classNames: Array<string | undefined>): string => {
  return classNames.filter(Boolean).join(" ");
};

export type GlassPaneProps = ComponentPropsWithoutRef<"section">;

export const GlassPane = ({ className, ...props }: GlassPaneProps) => {
  return <section className={joinClassNames("glass", "glass-pane", className)} {...props} />;
};

export type GlassPillProps = ComponentPropsWithoutRef<"div">;

export const GlassPill = ({ className, ...props }: GlassPillProps) => {
  return <div className={joinClassNames("glass", "glass-pill", className)} {...props} />;
};
